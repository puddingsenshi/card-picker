import { useEffect, useRef, useState } from "react";
import type { PointerInput } from "../pointer/types";
import {
  GRASP_DEFAULTS,
  type GraspThresholds,
  graspRatio,
  type Landmark,
  nextGrasp,
  type ScanOptions,
  scanIndex,
} from "./landmarks";

export type HandPointerStatus =
  /** 還沒啟動。 */
  | "idle"
  /** 正在下載模型。 */
  | "loading"
  /** 正在等使用者允許相機。 */
  | "requesting"
  /** 運作中。 */
  | "running"
  /** 使用者拒絕了相機。 */
  | "denied"
  /** 裝置不支援，或模型載不起來。 */
  | "unsupported";

/** WASM 與模型預設走 CDN——先確認手勢可用，再決定要不要把 7MB 的模型放進 repo。 */
const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_CDN =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export interface UseHandPointerOptions {
  count: number;
  /** 只有明確開啟才會載模型與要相機。 */
  enabled: boolean;
  scan?: Omit<ScanOptions, "count">;
  grasp?: GraspThresholds;
  wasmPath?: string;
  modelPath?: string;
}

export interface HandPointer extends PointerInput {
  status: HandPointerStatus;
  /** 偵測不到手。用來提示使用者把手舉進畫面。 */
  handLost: boolean;
}

/**
 * 以鏡頭做手部追蹤的一維指標。
 *
 * 它只產出 `PointerInput`——也就是 `usePointerSelection` 已經在消費的那個介面。
 * latch、必須放開才能再選、邊界夾住、來源中斷不誤觸，全部在那一層做完了，
 * 所以這裡的責任只有一件事：**如實回報「指著第幾張」與「有沒有握拳」**。
 *
 * 推論全部在瀏覽器本機執行，影像不上傳也不留存。
 */
export function useHandPointer(options: UseHandPointerOptions): HandPointer {
  const { count, enabled } = options;

  const [status, setStatus] = useState<HandPointerStatus>("idle");
  const [index, setIndex] = useState<number | null>(null);
  const [committing, setCommitting] = useState(false);
  const [handLost, setHandLost] = useState(true);

  // options 每次 render 都是新物件。用 ref 讓迴圈讀到最新設定，
  // 又不會因為調了一個閾值就把整個鏡頭重啟一次。
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      setIndex(null);
      setCommitting(false);
      setHandLost(true);
      return;
    }

    let cancelled = false;
    let frame = 0;
    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;
    let landmarker: { detectForVideo: typeof detectStub; close: () => void } | null = null;
    let grasped = false;

    async function start(): Promise<void> {
      try {
        setStatus("loading");
        // 動態 import：沒開 AR 的人不會下載 MediaPipe，也不會付這個 bundle 成本。
        const vision = await import("@mediapipe/tasks-vision");
        if (cancelled) return;

        const fileset = await vision.FilesetResolver.forVisionTasks(
          optionsRef.current.wasmPath ?? WASM_CDN,
        );
        if (cancelled) return;

        const created = await vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: optionsRef.current.modelPath ?? MODEL_CDN },
          // 只追一隻手。第二隻手進畫面會讓指標在兩者之間跳。
          numHands: 1,
          runningMode: "VIDEO",
        });
        if (cancelled) {
          created.close();
          return;
        }
        landmarker = created as unknown as typeof landmarker;

        setStatus("requesting");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
        });
        if (cancelled) return;

        video = document.createElement("video");
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        // 掛進 DOM 但看不見：部分瀏覽器不會替 detached 的 video 解碼影格。
        // 不能用 display:none，那會讓解碼整個停掉。
        video.style.cssText =
          "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;";
        video.srcObject = stream;
        document.body.appendChild(video);
        await video.play();
        if (cancelled) return;

        setStatus("running");
        loop();
      } catch (cause) {
        if (cancelled) return;
        const name = cause instanceof Error ? cause.name : "";
        // 權限被拒與「裝置壞了／模型載不起來」要分開——前者提示使用者可以重試，
        // 後者只能請他用點的。
        setStatus(
          name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unsupported",
        );
      }
    }

    function loop(): void {
      frame = requestAnimationFrame(loop);
      if (video === null || landmarker === null || video.readyState < 2) return;

      const result = landmarker.detectForVideo(video, performance.now());
      const hand = result.landmarks[0];

      if (hand === undefined || hand.length === 0) {
        setHandLost(true);
        // 手不見了就清掉目標，但**不動握拳狀態**——短暫的偵測閃失不該被
        // 當成「放開了」，否則使用者會莫名其妙連選兩張。
        setIndex(null);
        return;
      }

      setHandLost(false);
      const current = optionsRef.current;
      const next = scanIndex(hand, { count: current.count, ...current.scan });
      setIndex((previous) => (previous === next ? previous : next));

      grasped = nextGrasp(grasped, graspRatio(hand), current.grasp ?? GRASP_DEFAULTS);
      setCommitting((previous) => (previous === grasped ? previous : grasped));
    }

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      landmarker?.close();
      // 一定要停掉 track，否則分頁上的相機指示燈會一直亮著。
      stream?.getTracks().forEach((track) => track.stop());
      if (video !== null) {
        video.srcObject = null;
        video.remove();
      }
    };
  }, [enabled, count]);

  return {
    signal: index === null ? null : { kind: "index", value: index },
    committing,
    status,
    handLost,
  };
}

/** 只為了取得 detectForVideo 的型別，不會被呼叫。 */
declare function detectStub(
  video: HTMLVideoElement,
  timestamp: number,
): {
  landmarks: Landmark[][];
};
