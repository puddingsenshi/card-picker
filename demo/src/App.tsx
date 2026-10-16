import { useCallback, useId, useState } from "react";
import { type FanCardState, FanLayout, useCardSelection } from "@puddingsenshi/card-picker";
import { useKeyboardPointer, usePointerSelection } from "@puddingsenshi/card-picker/pointer";

const REPO = "https://github.com/puddingsenshi/card-picker";

interface KnobProps {
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
  onChange: (next: number) => void;
}

function Knob({ label, hint, min, max, step, value, unit = "", onChange }: KnobProps) {
  const id = useId();
  return (
    <div className="knob">
      <label className="knob-head" htmlFor={id}>
        <span className="knob-name">{label}</span>
        <span className="knob-value">
          {value}
          {unit}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <p className="knob-hint">{hint}</p>
    </div>
  );
}

export function App() {
  const [count, setCount] = useState(13);
  const [max, setMax] = useState(3);
  const [arc, setArc] = useState(34);
  const [pivot, setPivot] = useState(2.6);
  const [lift, setLift] = useState(2);
  const [deal, setDeal] = useState(true);
  // 改了排面就重新發一次牌，不然動畫只會在第一次載入時看到。
  const [round, setRound] = useState(0);

  const selection = useCardSelection({ max });
  const { picked, done, pick, reset } = selection;

  const keyboard = useKeyboardPointer({ count, enabled: !done });
  const { target } = usePointerSelection({
    input: keyboard,
    onPick: pick,
    enabled: !done,
    count,
  });

  const redeal = useCallback(() => {
    reset();
    setRound((n) => n + 1);
  }, [reset]);

  const renderCard = useCallback(
    ({ index, selected, order }: FanCardState) => (
      <div className="face" data-selected={selected}>
        <span className="face-index">{String(index + 1).padStart(2, "0")}</span>
        {selected ? <span className="face-order">{order + 1}</span> : null}
      </div>
    ),
    [],
  );

  const snippet = `<FanLayout
  count={${count}}
  geometry={{ arc: ${arc}, pivot: ${pivot}, lift: "${lift}rem" }}
  deal={${deal}}
  picked={picked}
  activeIndex={target}
  onPick={pick}
  renderCard={({ index, selected }) => /* 卡面由你畫 */}
/>`;

  return (
    <main>
      <header className="masthead">
        <h1>card-picker</h1>
        <p className="tagline">
          扇形選卡的互動元件。它只管怎麼排、指到哪張、選了哪些，不知道卡片是什麼，
          也不知道選完要做什麼。
        </p>
        <div className="meta">
          <code>npm i @puddingsenshi/card-picker</code>
          <a href={REPO}>原始碼</a>
        </div>
      </header>

      <section className="stage-wrap" aria-label="互動展示">
        <div className="stage">
          <FanLayout
            key={`${round}-${count}`}
            count={count}
            renderCard={renderCard}
            picked={picked}
            activeIndex={target}
            onPick={pick}
            disabled={done}
            deal={deal}
            geometry={{ arc, pivot, lift: `${lift}rem` }}
            cardLabel={({ index }) => `第 ${index + 1} 張`}
          />
        </div>

        <div className="status" role="status">
          <span className="status-text">
            {done
              ? `選好了：${picked.map((i) => i + 1).join("、")}`
              : `選 ${max} 張，已選 ${picked.length} 張`}
          </span>
          <div className="pips" aria-hidden="true">
            {Array.from({ length: max }, (_, slot) => (
              <span key={slot} data-filled={slot < picked.length} />
            ))}
          </div>
          <button type="button" onClick={redeal}>
            重發
          </button>
        </div>

        <p className="hint">
          滑鼠直接點。或者用<kbd>←</kbd> <kbd>→</kbd>移動、<kbd>Enter</kbd>
          選取——鍵盤走的是跟手勢同一條路徑。
        </p>
      </section>

      <section className="rail" aria-label="參數">
        <Knob
          label="張數"
          hint="攤開幾張。與要選幾張無關，純粹是排面。"
          min={3}
          max={30}
          step={1}
          value={count}
          onChange={(n) => {
            setCount(n);
            reset();
          }}
        />
        <Knob
          label="要選幾張"
          hint="選滿即完成，整副停止互動。"
          min={1}
          max={5}
          step={1}
          value={max}
          onChange={(n) => {
            setMax(n);
            reset();
          }}
        />
        <Knob
          label="張角"
          hint="扇形左右各張開的角度。"
          min={0}
          max={70}
          step={1}
          value={arc}
          unit="°"
          onChange={setArc}
        />
        <Knob
          label="樞紐"
          hint="虛擬圓心離卡頂多遠，單位是卡高。越大鋪得越開，兩端也垂得越低。"
          min={1.4}
          max={4.5}
          step={0.1}
          value={pivot}
          onChange={setPivot}
        />
        <Knob
          label="抬升"
          hint="被指到的卡往上推多少。選走的卡就停在這個高度。"
          min={0}
          max={5}
          step={0.25}
          value={lift}
          unit="rem"
          onChange={setLift}
        />
        <div className="knob">
          <span className="knob-head">
            <span className="knob-name">發牌動畫</span>
            <span className="knob-value">{deal ? "開" : "關"}</span>
          </span>
          <button
            type="button"
            className="toggle"
            aria-pressed={deal}
            onClick={() => {
              setDeal((on) => !on);
              redeal();
            }}
          >
            {deal ? "關掉，直接就位" : "打開，整疊浮現再攤開"}
          </button>
          <p className="knob-hint">浮現、停一拍、洗牌、依序攤開，四段各自可調或跳過。</p>
        </div>
      </section>

      <section className="code" aria-label="對應的程式碼">
        <h2>你現在看到的就是這段</h2>
        <pre>
          <code>{snippet}</code>
        </pre>
      </section>

      <section className="notes" aria-label="設計決定">
        <h2>三個做給自己踩過的坑</h2>
        <dl>
          <div>
            <dt>選的是按下去那一刻指著的那張</dt>
            <dd>
              握拳、按鍵、點擊，任何確認動作都會讓指標位移一點。不先鎖住，選到的就會是隔壁那張。
            </dd>
          </div>
          <div>
            <dt>按住不放不會連選</dt>
            <dd>
              只認按下去的那個上升緣，必須放開才能選下一張。這個三態循環天生自帶冷卻，不必再加時間鎖。
            </dd>
          </div>
          <div>
            <dt>一維訊號不轉成座標</dt>
            <dd>
              手掌水平掃描本來就已經是索引了。換算成座標再反查回來，只是把精確的數字降格再猜一次。
            </dd>
          </div>
        </dl>
      </section>

      <footer>
        <a href={REPO}>GitHub</a>
        <span aria-hidden="true">·</span>
        <a href="https://skill-hub-orpin.vercel.app">成長記錄</a>
      </footer>
    </main>
  );
}
