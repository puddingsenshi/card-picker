import { createRequire } from "node:module";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);
const src = (p: string) => fileURLToPath(new URL(`../src/${p}`, import.meta.url));

/*
 * Demo 直接吃 ../src，不吃 dist——改了庫就看得到，不必先 build 一次。
 *
 * 代價是 ../src 裡的 `import "react"` 會解析到 card-picker 自己的 devDependency，
 * 跟 demo 用的那份不是同一個 React。兩份 React 在 production build 會讓
 * hook 的 dispatcher 變成 null（dev 的預打包剛好把它們併成一份，所以只有
 * build 出來才看得到）。dedupe 加明確 alias 把兩邊釘在同一份上。
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@puddingsenshi/card-picker/style.css": src("fan-layout.css"),
      "@puddingsenshi/card-picker/pointer": src("pointer/index.ts"),
      "@puddingsenshi/card-picker": src("index.ts"),
      react: fileURLToPath(new URL("./node_modules/react", import.meta.url)),
      "react-dom": fileURLToPath(new URL("./node_modules/react-dom", import.meta.url)),
    },
  },
});
