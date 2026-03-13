/** @format */

import { app } from "../../scripts/app.js"
import { ComfyWidgets } from "../../scripts/widgets.js"
import { injectSP8999Styles } from "./text_utils_sp_style.js"

// --------------------------------------------------
// graphToPromptをパッチ
// 動的に作成したウィジェットの値をプロンプトに注入する
// （nodeData定義から削除したoptional入力の値を補完）
// --------------------------------------------------
const origGraphToPrompt = app.graphToPrompt
app.graphToPrompt = async function (...args) {
	const result = await origGraphToPrompt.apply(this, args)

	if (!result || !result.output) return result

	for (const [id, nodePrompt] of Object.entries(result.output)) {
		if (nodePrompt.class_type !== "weightMultiText" && nodePrompt.class_type !== "multiText") continue

		const node = app.graph.getNodeById(parseInt(id))
		if (!node) continue

		const textCountWidget = node.widgets.find((w) => w.name === "text_count")
		const count = textCountWidget ? textCountWidget.value : 1

		// text_2〜text_N, weight_2〜weight_N をプロンプトに注入
		for (let i = 2; i <= count; i++) {
			const textW = node.widgets.find((w) => w.name === `text_${i}`)
			const weightW = node.widgets.find((w) => w.name === `weight_${i}`)

			if (textW) {
				nodePrompt.inputs[`text_${i}`] = textW.value ?? ""
			}
			if (weightW) {
				nodePrompt.inputs[`weight_${i}`] = weightW.value ?? 1.0
			}
		}
	}

	return result
}

// --------------------------------------------------
// エクステンション登録
// --------------------------------------------------
app.registerExtension({
	name: "sp8999.WeightMultiText",

	async beforeRegisterNodeDef(nodeType, nodeData, appInstance) {
		if (nodeData.name !== "weightMultiText" && nodeData.name !== "multiText" && nodeData.name !== "multiTextConcat") return

		console.log("[WeightMultiText] ★ エクステンション登録開始")

		injectSP8999Styles()

		// optional入力をノード定義から削除
		// → フロントエンドに入力スロットやウィジェットが自動生成されなくなる
		// ※バックエンド(Python)にはoptional定義が残っているので値は受け付ける
		if (nodeData.input && nodeData.input.optional) {
			delete nodeData.input.optional
		}

		// -------------------------------------------
		// ノード作成時の初期化
		// -------------------------------------------
		const onNodeCreated = nodeType.prototype.onNodeCreated
		nodeType.prototype.onNodeCreated = function () {
			onNodeCreated?.apply(this, arguments)
			console.log("[WeightMultiText] onNodeCreated 呼出")

			// text_count ウィジェットを非表示（内部管理用）
			// ガイドに従い type="hidden", computeSize=[0,0], hidden=true で完全に非表示化
			const textCountWidget = this.widgets.find((w) => w.name === "text_count")
			if (textCountWidget) {
				textCountWidget.type = "hidden"
				textCountWidget.computeSize = () => [0, 0]
				textCountWidget.hidden = true
				console.log(
					"[WeightMultiText] text_count を非表示化, 初期値:",
					textCountWidget.value,
				)
			}

			// −/+カウンターウィジェットを追加
			this._addCounterWidget()

			// ノードサイズを調整
			const node = this
			setTimeout(() => {
				node.setSize(node.computeSize())
			}, 50)
		}

		nodeType.prototype._addCounterWidget = function () {
			const nodeRef = this
			console.log("[WeightMultiText] _addCounterWidget 呼出")

			const domWidgetContainer = document.createElement("div")
			domWidgetContainer.className = "sp8999-counter-dom-wrapper"

			const container = document.createElement("div")
			container.className = "sp8999-counter-container"

			const btnMinus = document.createElement("div")
			btnMinus.className = "sp8999-counter-btn"
			btnMinus.textContent = "−"

			const valDisplay = document.createElement("div")
			valDisplay.className = "sp8999-counter-val"

			const btnPlus = document.createElement("div")
			btnPlus.className = "sp8999-counter-btn"
			btnPlus.textContent = "+"

			container.appendChild(btnMinus)
			container.appendChild(valDisplay)
			container.appendChild(btnPlus)

			domWidgetContainer.appendChild(container)

			const domWidget = this.addDOMWidget(
				"input_counter",
				"custom",
				domWidgetContainer,
			)
			// デフォルトの描画（枠・テキスト）を無効化
			domWidget.draw = () => { }

			console.log("[WeightMultiText] domWidget 作成完了:", domWidget)

			const updateDisplay = () => {
				const tcw = nodeRef.widgets.find((w) => w.name === "text_count")
				const count = tcw ? tcw.value : 1
				valDisplay.textContent = String(count)
				console.log("[WeightMultiText] updateDisplay: count =", count)

				if (count <= 1) {
					btnMinus.classList.add("disabled")
				} else {
					btnMinus.classList.remove("disabled")
				}

				if (count >= 20) {
					btnPlus.classList.add("disabled")
				} else {
					btnPlus.classList.remove("disabled")
				}
			}

			// -----------------------------------------------
			// select_texts.js と同じ手法: onclick を各要素に直接設定
			// ★ pointerdown + preventDefault() はUI 2.0でclick発火を抑制するため使用しない
			// -----------------------------------------------

			// 「−」ボタン
			btnMinus.onclick = (e) => {
				e.preventDefault()
				e.stopPropagation()
				const tcw = nodeRef.widgets.find((w) => w.name === "text_count")
				if (!tcw || tcw.value <= 1) {
					console.log("[WeightMultiText] − clicked: 最小値のため無視")
					return
				}
				console.log(`[WeightMultiText] − clicked: ${tcw.value} -> ${tcw.value - 1}`)
				nodeRef._removeLastInput()
				updateDisplay()
				// キャッシュ無効化のための変更通知
				domWidget.value = (domWidget.value || 0) + 1
				if (nodeRef.graph) nodeRef.graph._version++
				app.graph.setDirtyCanvas(true, true)
			}

			// 「+」ボタン
			btnPlus.onclick = (e) => {
				e.preventDefault()
				e.stopPropagation()
				const tcw = nodeRef.widgets.find((w) => w.name === "text_count")
				if (!tcw || tcw.value >= 20) {
					console.log("[WeightMultiText] + clicked: 最大値のため無視")
					return
				}
				console.log(`[WeightMultiText] + clicked: ${tcw.value} -> ${tcw.value + 1}`)
				nodeRef._addNewInput()
				updateDisplay()
				// キャッシュ無効化のための変更通知
				domWidget.value = (domWidget.value || 0) + 1
				if (nodeRef.graph) nodeRef.graph._version++
				app.graph.setDirtyCanvas(true, true)
			}

			// 数値表示部分クリック → 自前のプロンプトで直接数値入力
			valDisplay.onclick = (e) => {
				e.preventDefault()
				e.stopPropagation()

				const tcw = nodeRef.widgets.find((w) => w.name === "text_count")
				const currentCount = tcw ? tcw.value : 1
				console.log(
					"[WeightMultiText] 数値クリック: 現在のカウント =",
					currentCount,
				)

				// setTimeout でイベント処理の外に出してからプロンプトを表示
				setTimeout(() => {
					const input = window.prompt(
						"テキスト入力数を指定 (1〜20):",
						String(currentCount),
					)
					if (input === null) {
						console.log("[WeightMultiText] プロンプトキャンセル")
						return
					}

					let targetCount = parseInt(input, 10)
					if (isNaN(targetCount)) {
						console.warn(`[WeightMultiText] 無効な入力: "${input}"`)
						return
					}

					// 範囲制限
					if (targetCount < 1) targetCount = 1
					if (targetCount > 20) targetCount = 20

					console.log(
						`[WeightMultiText] 直接入力: 目標=${targetCount}, 現在=${currentCount}`,
					)

					if (targetCount > currentCount) {
						for (let i = 0; i < targetCount - currentCount; i++) {
							nodeRef._addNewInput()
						}
					} else if (targetCount < currentCount) {
						for (let i = 0; i < currentCount - targetCount; i++) {
							nodeRef._removeLastInput()
						}
					}

					updateDisplay()
					domWidget.value = (domWidget.value || 0) + 1
					if (nodeRef.graph) nodeRef.graph._version++
					app.graph.setDirtyCanvas(true, true)
				}, 10)
			}

			setTimeout(() => {
				updateDisplay()
			}, 10)

			requestAnimationFrame(() => {
				domWidget.computeSize = function (width) {
					return [width, 32]
				}
				nodeRef.setSize(nodeRef.computeSize())
				if (nodeRef.graph) nodeRef.graph._version++
			})

			// text_count ウィジェットの直後に移動する
			if (this.widgets.length > 1) {
				const idx = this.widgets.indexOf(domWidget)
				if (idx !== -1) {
					this.widgets.splice(idx, 1)
					const tcwIdx = this.widgets.findIndex((w) => w.name === "text_count")
					if (tcwIdx !== -1) {
						this.widgets.splice(tcwIdx + 1, 0, domWidget)
					} else {
						this.widgets.splice(1, 0, domWidget)
					}
				}
			}

			console.log(
				"[WeightMultiText] _addCounterWidget 完了, ウィジェット一覧:",
				this.widgets.map((w) => w.name),
			)
		}

		// -------------------------------------------
		// 新しいテキスト＋ウェイト入力ペアを追加
		// -------------------------------------------
		nodeType.prototype._addNewInput = function () {
			const tcw = this.widgets.find((w) => w.name === "text_count")
			if (!tcw || tcw.value >= 20) return

			const newCount = ++tcw.value

			if (this.comfyClass === "multiTextConcat" || this.type === "multiTextConcat") {
				this.addInput(`text_${newCount}`, "STRING")
			} else {
				// ComfyWidgetsでマルチラインテキストウィジェットを作成
				ComfyWidgets["STRING"](
					this,
					`text_${newCount}`,
					["STRING", { multiline: true, default: "" }],
					app,
				)
			}

			if (this.comfyClass === "weightMultiText" || this.type === "weightMultiText") {
				// 数値ウィジェットを追加 (this.addWidgetの代わりにComfyWidgetsを使用)
				ComfyWidgets["FLOAT"](
					this,
					`weight_${newCount}`,
					["FLOAT", { default: 1.0, min: 0.0, max: 2.0, step: 0.05 }],
					app,
				)

				const wW = this.widgets.find((w) => w.name === `weight_${newCount}`)
				if (wW && wW.options) {
					wW.options.precision = 2
					wW.options.step = 0.05
				}
			}

			this.setSize(this.computeSize())
			// UI v1対応：ウィジェットの高さを手動で調整
			// ds.scaleのチェックを緩和し、より積極的に再計算を行う
			// v1の判定をより明確にするため、scale < 1.6 とする (1.5だと境界が曖昧な場合があるため)
			if (this.graph?.canvas?.ds?.scale && this.graph.canvas.ds.scale < 1.6) {
				requestAnimationFrame(() => {
					this.setSize(this.computeSize())
					// キャンバス全体を再描画してUI更新を確実にする
					app.graph.setDirtyCanvas(true, true)
					// 追加のrequestAnimationFrameで再度サイズ計算を実行
					requestAnimationFrame(() => {
						this.setSize(this.computeSize())
						app.graph.setDirtyCanvas(true, true)
					})
				})
			} else {
				app.graph.setDirtyCanvas(true, true)
			}
		}

		// -------------------------------------------
		// 最後のテキスト＋ウェイト入力ペアを削除
		// -------------------------------------------
		nodeType.prototype._removeLastInput = function () {
			const tcw = this.widgets.find((w) => w.name === "text_count")
			if (!tcw || tcw.value <= 1) return

			const count = tcw.value
			const textName = `text_${count}`
			const weightName = `weight_${count}`

			if (this.comfyClass === "multiTextConcat" || this.type === "multiTextConcat") {
				const inputSlot = this.findInputSlot(textName)
				if (inputSlot !== -1) {
					this.removeInput(inputSlot)
				}
			} else {
				// DOM要素（textarea）を安全にクリーンアップ
				const textW = this.widgets.find((w) => w.name === textName)
				if (textW) {
					if (textW.onRemove) {
						textW.onRemove()
					} else if (textW.inputEl && textW.inputEl.parentNode) {
						textW.inputEl.remove()
					} else if (textW.element && textW.element.parentNode) {
						textW.element.remove()
					}
					const idx = this.widgets.indexOf(textW)
					if (idx !== -1) this.widgets.splice(idx, 1)
				}
			}

			// 数値ウィジェットも安全にクリーンアップ
			const weightW = this.widgets.find((w) => w.name === weightName)
			if (weightW) {
				if (weightW.onRemove) {
					weightW.onRemove()
				}
				const idx = this.widgets.indexOf(weightW)
				if (idx !== -1) this.widgets.splice(idx, 1)
			}

			tcw.value = count - 1

			this.setSize(this.computeSize())
			// UI v1対応：ウィジェットの高さを手動で調整
			// v1の判定をより明確にするため、scale < 1.6 とする
			if (this.graph?.canvas?.ds?.scale && this.graph.canvas.ds.scale < 1.6) {
				requestAnimationFrame(() => {
					this.setSize(this.computeSize())
					// 追加のrequestAnimationFrameで再度サイズ計算を実行
					requestAnimationFrame(() => {
						this.setSize(this.computeSize())
					})
				})
			}
			app.graph.setDirtyCanvas(true, true)
		}

		// -------------------------------------------
		// ワークフロー読み込み時: 動的ウィジェットを復元
		// -------------------------------------------
		const onConfigure = nodeType.prototype.onConfigure
		nodeType.prototype.onConfigure = function (info) {
			onConfigure?.apply(this, arguments)

			const tcw = this.widgets.find((w) => w.name === "text_count")
			if (!tcw) return

			const savedCount = tcw.value
			if (savedCount <= 1) return

			// 既に動的ウィジェット/入力があれば復元不要
			if (this.comfyClass === "multiTextConcat" || this.type === "multiTextConcat") {
				const existing = this.inputs ? this.inputs.filter((inp) => inp.name.match(/^text_\d+$/) && inp.name !== "text_1") : []
				if (existing.length >= savedCount - 1) return
			} else {
				const existing = this.widgets.filter(
					(w) => w.name.match(/^text_\d+$/) && w.name !== "text_1",
				)
				if (existing.length >= savedCount - 1) return
			}

			const savedValues = info.widgets_values || []

			// text_countを1にリセットし、順にペアを追加
			tcw.value = 1

			const isWeight = (this.comfyClass === "weightMultiText" || this.type === "weightMultiText")
			const isConcat = (this.comfyClass === "multiTextConcat" || this.type === "multiTextConcat")

			// 基本ウィジェット数: text_count(hidden), counter, text_1, (weight_1)
			let BASE_WIDGET_COUNT = 3
			if (isWeight) {
				BASE_WIDGET_COUNT = 4
			} else if (isConcat) {
				BASE_WIDGET_COUNT = 2 // text_count(hidden), counter
			}

			for (let i = 2; i <= savedCount; i++) {
				this._addNewInput()

				if (!isConcat) {
					// 保存された値を復元
					const textIdx = BASE_WIDGET_COUNT + (i - 2) * (isWeight ? 2 : 1)
					const weightIdx = textIdx + 1

					const textW = this.widgets.find((w) => w.name === `text_${i}`)
					const weightW = this.widgets.find((w) => w.name === `weight_${i}`)

					if (textW && textIdx < savedValues.length) {
						textW.value = savedValues[textIdx]
						if (textW.inputEl) textW.inputEl.value = savedValues[textIdx]
					}
					if (isWeight && weightW && weightIdx < savedValues.length) {
						weightW.value = savedValues[weightIdx]
					}
				}
			}

			this.setSize(this.computeSize())
		}
	},
})
