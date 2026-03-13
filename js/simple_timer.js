import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
    name: "sp8999.SimpleTimerEnd",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "SimpleTimerEnd") {
            // ノード作成時
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);

                // ウィジェット作成
                const existing = this.widgets?.find(w => w.name === "display_text");
                if (!existing) {
                    const w = ComfyWidgets["STRING"](this, "display_text", ["STRING", { multiline: false }], app).widget;
                    if (w) {
                        if (w.inputEl) {
                            w.inputEl.readOnly = true;
                            w.inputEl.style.opacity = 0.6;
                        }
                        w.value = "Ready";
                    }
                }
            };

            // 実行完了時 (v1用)
            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function (message) {
                onExecuted?.apply(this, arguments);

                // Python側からのメッセージがある場合
                if (message && message.text) {
                    const w = this.widgets?.find((w) => w.name === "display_text" || w.type === "customtext");
                    if (w) {
                        const newValue = message.text[0];
                        // ウィジェットの値を更新
                        w.value = newValue;

                        // 重要: inputElが存在する場合は直接更新しないと画面に反映されないことがある
                        if (w.inputEl) {
                            w.inputEl.value = newValue;
                        }

                        // キャンバス再描画
                        this.setDirtyCanvas(true, true);
                    }
                }
            }
        }
    },
    async setup() {
        // v2環境などでの安定した値の更新用 (APIからの汎用キャッチ)
        api.addEventListener("executed", (e) => {
            const detail = e.detail;
            if (detail && detail.node) {
                const node = app.graph.getNodeById(detail.node);
                if (node && node.comfyClass === "SimpleTimerEnd") {
                    if (detail.output && detail.output.text) {
                        const w = node.widgets?.find((w) => w.name === "display_text" || w.type === "customtext");
                        if (w) {
                            const newValue = detail.output.text[0];
                            w.value = newValue;
                            if (w.inputEl) {
                                w.inputEl.value = newValue;
                            }
                            node.setDirtyCanvas(true, true);
                        }
                    }
                }
            }
        });
    }
});
