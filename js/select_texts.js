import { app } from "../../scripts/app.js"
import { api } from "../../scripts/api.js"
import { injectSP8999Styles } from "./text_utils_sp_style.js"

app.registerExtension({
    name: "sp8999.SelectTexts",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "SelectTexts" && nodeData.name !== "SelectLists") return;

        // optional入力から toggle_states_json を削除し、フロントエンドが勝手に入力ポート化するのを防ぐ
        if (nodeData.input && nodeData.input.optional && nodeData.input.optional.toggle_states_json) {
            delete nodeData.input.optional.toggle_states_json;
        }

        // -------------------------------------------
        // ノード作成時の初期化
        // -------------------------------------------
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply(this, arguments);
            injectSP8999Styles();

            this._selectTextsData = {
                textList: [],
                states: {},
            };
            this._toggleWidgets = [];

            // 手動で保存用の隠しウィジェットを作成
            const stateWidget = this.addWidget("string", "toggle_states_json", "{}");
            stateWidget.type = "hidden";
            stateWidget.computeSize = () => [0, 0];
            stateWidget.hidden = true;

            // api "executed" イベントリスナーを登録
            const nodeRef = this;
            this._onApiExecuted = (event) => {
                const detail = event.detail;
                if (!detail) return;
                const nodeId = String(detail.node);
                if (nodeId !== String(nodeRef.id)) return;

                const output = detail.output;
                if (!output) return;

                nodeRef._handleExecutionResult(output);
            };
            api.addEventListener("executed", this._onApiExecuted);
        };

        // -------------------------------------------
        // 実行結果を処理する共通メソッド
        // -------------------------------------------
        nodeType.prototype._handleExecutionResult = function (message) {
            if (!message || (!message.text_list && !message.display_groups)) return;

            const textList = message.text_list || [];
            const displayGroups = message.display_groups ? JSON.parse(message.display_groups[0]) : [textList];
            const isExcludedMode = message.is_excluded_mode && message.is_excluded_mode[0] === true;
            let states = {};

            if (message.toggle_states && message.toggle_states[0]) {
                try {
                    states = JSON.parse(message.toggle_states[0]);
                } catch (e) {
                    states = {};
                }
            }

            // 既存のJS側の状態をマージ（JS側の操作が優先）
            if (this._selectTextsData && Object.keys(this._selectTextsData.states).length > 0) {
                if (isExcludedMode) {
                    for (let i = 0; i < textList.length; i++) {
                        const key = String(i);
                        if (this._selectTextsData.states[key] !== undefined) {
                            states[key] = this._selectTextsData.states[key];
                        }
                    }
                } else {
                    for (const key of Object.keys(this._selectTextsData.states)) {
                        if (textList.includes(key)) {
                            states[key] = this._selectTextsData.states[key];
                        }
                    }
                }
            }

            // textListに存在しない古いキー（上流で削除されたもの）をstatesから削除
            if (isExcludedMode) {
                for (const key of Object.keys(states)) {
                    if (parseInt(key, 10) >= textList.length) {
                        delete states[key];
                    }
                }
            } else {
                for (const key of Object.keys(states)) {
                    if (!textList.includes(key)) {
                        delete states[key];
                    }
                }
            }

            this._selectTextsData = {
                textList: textList,
                displayGroups: displayGroups,
                states: states,
                resultText: message.result_text ? message.result_text[0] : null,
                isExcludedMode: isExcludedMode
            };

            // デフォルト状態設定
            if (isExcludedMode) {
                for (let i = 0; i < textList.length; i++) {
                    if (states[String(i)] === undefined) states[String(i)] = true;
                }
            } else {
                for (const t of textList) {
                    if (states[t] === undefined) states[t] = true;
                }
            }

            // ComfyUI標準のウィジェット（実行用の隠し文字列）にも新しい状態を即時同期させる
            const stateWidget = this.widgets?.find(w => w.name === "toggle_states_json");
            if (stateWidget) {
                stateWidget.value = JSON.stringify(states);
            }

            this._buildToggleButtons();
            this._syncStatesToServer();
        };

        // -------------------------------------------
        // 実行完了時（onExecutedは使わずapiリスナーのみ使用）
        // onExecutedとapiリスナーの二重呼出を防ぐため、
        // onExecutedは無効化する
        // -------------------------------------------

        // -------------------------------------------
        // DOM Widget としてトグルボタンを構築 (HTMLベース)
        // -------------------------------------------
        nodeType.prototype._buildToggleButtons = function () {
            console.log("[SelectTexts] _buildToggleButtons 呼出");

            if (!this._selectTextsData || !this._selectTextsData.displayGroups) {
                console.log("[SelectTexts] データなし、ビルド中断", this._selectTextsData);
                return;
            }

            const nodeRef = this;
            const currentData = this._selectTextsData;
            // V1/V2判定を関数スコープで保持
            const isV2 = document.getElementsByTagName("comfy-app").length > 0;
            console.log("[SelectTexts] currentData:", currentData, "isV2:", isV2);

            // コンテナの取得または作成
            let domWidget = this.widgets?.find(w => w.name === "select_texts_buttons");
            let container;

            if (domWidget && domWidget.element) {
                // 既存のコンテナがあれば中身を空にして再利用
                container = domWidget.element;
                container.innerHTML = "";
            } else {
                // 新規作成
                container = document.createElement("div");
                container.className = "sp8999-select-texts-container";

                // V1の場合は上の文字と被らないよう margin-top を調整する
                if (!isV2) {
                    container.style.marginTop = "5px";
                }

                // addDOMWidgetでDOMをウィジェットとして追加
                domWidget = this.addDOMWidget("select_texts_buttons", "custom", container);
                console.log("[SelectTexts] addDOMWidget 戻り値:", domWidget);
                this._toggleWidgets = [domWidget];

                // ウィジェットのデフォルト描画を非表示に（DOMのみで表示）
                domWidget.draw = () => { };
            }

            // 各グループとボタンの構築
            if (currentData.isExcludedMode) {
                // SelectLists 用のレイアウト (トグルスイッチ＋プレビュー)
                const listContainer = document.createElement("div");
                listContainer.className = "sp8999-excl-list-container";

                currentData.textList.forEach((text, i) => {
                    const key = String(i);
                    const isOn = currentData.states[key] !== false;

                    const row = document.createElement("div");
                    row.className = "sp8999-excl-row";

                    const toggleFunc = () => {
                        const newState = !currentData.states[key];
                        currentData.states[key] = newState;
                        if (newState) {
                            toggleBtn.classList.add("is-on");
                        } else {
                            toggleBtn.classList.remove("is-on");
                        }

                        const stateWidget = nodeRef.widgets?.find(w => w.name === "toggle_states_json");
                        if (stateWidget) {
                            stateWidget.value = JSON.stringify(currentData.states);
                        }

                        domWidget.value = (domWidget.value || 0) + 1;
                        if (nodeRef.graph) nodeRef.graph._version++;
                        if (app.graph) app.graph.setDirtyCanvas(true, true);
                        nodeRef.setDirtyCanvas(true, true);

                        nodeRef._syncStatesToServer();
                    };

                    const toggleBtn = document.createElement("div");
                    toggleBtn.className = "sp8999-excl-toggle" + (isOn ? " is-on" : "");
                    toggleBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFunc();
                    };

                    const labelDiv = document.createElement("div");
                    labelDiv.className = "sp8999-excl-label";
                    labelDiv.textContent = text;

                    row.appendChild(toggleBtn);
                    row.appendChild(labelDiv);
                    listContainer.appendChild(row);
                });

                container.appendChild(listContainer);

            } else {
                for (const group of currentData.displayGroups) {
                    const groupDiv = document.createElement("div");
                    groupDiv.className = "sp8999-select-texts-group";

                    for (const text of group) {
                        const isOn = currentData.states[text] !== false;
                        const btn = document.createElement("div");
                        btn.className = "sp8999-select-texts-btn" + (isOn ? " is-active" : "");
                        btn.textContent = text;

                        // クリックイベント
                        btn.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const newState = !currentData.states[text];
                            currentData.states[text] = newState;

                            if (newState) {
                                btn.classList.add("is-active");
                            } else {
                                btn.classList.remove("is-active");
                            }

                            // ComfyUI標準のウィジェットを更新してキャッシュ無効化・サーバーへ送信させる
                            const stateWidget = nodeRef.widgets?.find(w => w.name === "toggle_states_json");
                            if (stateWidget) {
                                stateWidget.value = JSON.stringify(currentData.states);
                            }

                            // ComfyUI (UI 2.0) に変更を検知させ、次回のRunで再実行（キャッシュ無効化）させるためのハック
                            domWidget.value = (domWidget.value || 0) + 1;
                            if (nodeRef.graph) nodeRef.graph._version++;
                            if (app.graph) app.graph.setDirtyCanvas(true, true);
                            nodeRef.setDirtyCanvas(true, true);

                            nodeRef._syncStatesToServer();
                        };

                        groupDiv.appendChild(btn);
                    }
                    container.appendChild(groupDiv);
                }
            }

            // プレビュー表示エリアの追加
            if (currentData.resultText) {
                const previewWrapper = document.createElement("div");
                previewWrapper.className = "sp8999-preview-wrapper";

                const label = document.createElement("div");
                label.className = "sp8999-preview-label";
                label.textContent = "OUTPUT PREVIEW:";
                previewWrapper.appendChild(label);

                const previewText = document.createElement("div");
                previewText.className = "sp8999-preview-text";
                previewText.textContent = currentData.resultText;
                previewWrapper.appendChild(previewText);

                container.appendChild(previewWrapper);
            }

            console.log("[SelectTexts] コンテナ構築完了", container);

            // サイズ更新ヘルパー
            const updateNodeSize = () => {
                const rect = container.getBoundingClientRect();
                const extraMargin = isV2 ? 0 : 20;
                const newHeight = (rect.height || 100) + extraMargin;
                console.log("[SelectTexts] updateNodeSize: rect.height=", rect.height, "newHeight=", newHeight);
                domWidget.computeSize = function (width) {
                    return [width, newHeight];
                };
                nodeRef.setSize(nodeRef.computeSize());
                if (nodeRef.graph) nodeRef.graph._version++;
            };

            // ResizeObserverでコンテナサイズ変化を動的に追従
            if (this._selectTextsResizeObs) {
                this._selectTextsResizeObs.disconnect();
            }
            this._selectTextsResizeObs = new ResizeObserver(() => {
                updateNodeSize();
            });
            this._selectTextsResizeObs.observe(container);

            // 初回サイズ計算（DOMレイアウト確定後）
            requestAnimationFrame(() => {
                setTimeout(() => {
                    updateNodeSize();
                }, 50);
            });
        };

        // -------------------------------------------
        // トグルウィジェットを削除
        // -------------------------------------------
        nodeType.prototype._removeToggleWidgets = function () {
            if (!this._toggleWidgets || !this.widgets) return;

            for (const w of this._toggleWidgets) {
                const idx = this.widgets.indexOf(w);
                if (idx >= 0) {
                    this.widgets.splice(idx, 1);
                }

                // 独自のDOM要素の破棄処理（UI2.0対応）
                // element.remove()を直接呼ぶとVue等のシステムと競合してノード自体がおかしくなる場合があるため、
                // ウィジェット標準の onRemove をフックするか、親要素から安全に外す
                if (w.onRemove) {
                    w.onRemove();
                } else if (w.element && w.element.parentNode) {
                    w.element.parentNode.removeChild(w.element);
                }
            }
            this._toggleWidgets = [];
        };

        // -------------------------------------------
        // トグル状態をサーバーに送信
        // -------------------------------------------
        nodeType.prototype._syncStatesToServer = async function () {
            if (!this._selectTextsData) return;
            try {
                await fetch("/select_texts/set_states", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        node_id: String(this.id),
                        states: this._selectTextsData.states,
                    }),
                });
            } catch (e) {
                console.error("[SelectTexts] サーバー同期エラー:", e);
            }
        };

        // -------------------------------------------
        // ノード削除時: APIリスナーをクリーンアップ
        // -------------------------------------------
        const onRemoved = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () {
            if (this._onApiExecuted) {
                api.removeEventListener("executed", this._onApiExecuted);
                this._onApiExecuted = null;
            }
            onRemoved?.apply(this, arguments);
        };

        // -------------------------------------------
        // ワークフロー読み込み時: 保存済みの状態を復元
        // -------------------------------------------
        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function (info) {
            onConfigure?.apply(this, arguments);

            // toggle_states_json ウィジェットから状態を復元
            const stateWidget = this.widgets?.find(w => w.name === "toggle_states_json");
            if (stateWidget && stateWidget.value) {
                try {
                    const parsed = JSON.parse(stateWidget.value);
                    if (parsed && typeof parsed === "object") {
                        if (this._selectTextsData) {
                            this._selectTextsData.states = parsed;
                        }
                    }
                } catch (e) { /* 無視 */ }
            }
        };

        // -------------------------------------------
        // シリアライズ時: 
        // -------------------------------------------
        const onSerialize = nodeType.prototype.onSerialize;
        nodeType.prototype.onSerialize = function (info) {
            onSerialize?.apply(this, arguments);
        };
    }
});
