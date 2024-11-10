<!-- eslint-disable no-useless-escape -->
<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="main">
    <div class="w-full h-full" v-html="compiledCode" />
  </div>
  <v-dialog
    v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen"
    :max-width="interfaceStore.isOnSmallScreen ? '100%' : '800px'"
    @after-enter="handleDialogOpen"
    @after-leave="handleDialogClose"
  >
    <vue-draggable-resizable :drag-handle="'.drag-handle'" w="auto" h="auto" :handles="['tm', 'mr', 'bm', 'ml']">
      <v-card class="pa-2" :style="interfaceStore.globalGlassMenuStyles">
        <v-card-title>
          <v-icon class="drag-handle">mdi-drag</v-icon>
          Do It Yourself widget configuration
        </v-card-title>
        <v-card-text>
          <div ref="htmlEditorContainer" class="editor-container" />
          <div ref="cssEditorContainer" class="editor-container" />
          <div ref="jsEditorContainer" class="editor-container" />
        </v-card-text>
        <v-card-actions>
          <div class="flex justify-between items-center pa-2 w-full h-full">
            <v-btn color="white" variant="text" @click="closeDialog">Close</v-btn>
            <div class="flex gap-x-10">
              <v-btn variant="text" @click="resetChanges">Reset</v-btn>
              <v-btn color="primary" variant="text" @click="applyChanges">Apply</v-btn>
            </div>
          </div>
        </v-card-actions>
      </v-card>
    </vue-draggable-resizable>
  </v-dialog>
</template>

<script setup lang="ts">
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref, toRefs } from 'vue'

import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') {
      return new jsonWorker()
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker()
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker()
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker()
    }
    return new editorWorker()
  },
}

const interfaceStore = useAppInterfaceStore()
const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()

const widget = toRefs(props).widget
const htmlEditorContainer = ref<HTMLElement | null>(null)
const cssEditorContainer = ref<HTMLElement | null>(null)
const jsEditorContainer = ref<HTMLElement | null>(null)
let htmlEditor: monaco.editor.IStandaloneCodeEditor | null = null
let cssEditor: monaco.editor.IStandaloneCodeEditor | null = null
let jsEditor: monaco.editor.IStandaloneCodeEditor | null = null

const defaultOptions = {
  html: `<div id="diy-container">
  <!-- Write your HTML code here -->
</div>`,
  css: `/* Write your CSS code here */
#diy-container {
  width: 100%;
  height: 100%;
}`,
  js: `// Write your JavaScript code here
document.addEventListener('DOMContentLoaded', () => {
  // Your code here
});`,
}

const compiledCode = computed(() => {
  const html = widget.value.options.html || defaultOptions.html
  const css = widget.value.options.css || defaultOptions.css
  const js = widget.value.options.js || defaultOptions.js

  return `${html}
<style>
${css}
</style>
<script>
${js}
<\/script>`
})

const createEditor = (container: HTMLElement, language: string, value: string): monaco.editor.IStandaloneCodeEditor => {
  return monaco.editor.create(container, {
    value,
    language,
    theme: 'vs-dark',
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: 'on',
  })
}

const initEditor = async (): Promise<void> => {
  if (htmlEditor || !htmlEditorContainer.value) return
  if (cssEditor || !cssEditorContainer.value) return
  if (jsEditor || !jsEditorContainer.value) return

  htmlEditor = createEditor(htmlEditorContainer.value, 'html', widget.value.options.html || defaultOptions.html)
  cssEditor = createEditor(cssEditorContainer.value, 'css', widget.value.options.css || defaultOptions.css)
  jsEditor = createEditor(jsEditorContainer.value, 'javascript', widget.value.options.js || defaultOptions.js)
}

const handleDialogOpen = async (): Promise<void> => {
  await initEditor()
}

const handleDialogClose = async (): Promise<void> => {
  finishEditor()
}

const applyChanges = (): void => {
  if (!htmlEditor || !cssEditor || !jsEditor) return
  widget.value.options.html = htmlEditor.getValue()
  widget.value.options.css = cssEditor.getValue()
  widget.value.options.js = jsEditor.getValue()
  executeUserScript()
}

const executeUserScript = (): void => {
  const js = widget.value.options.js || ''
  const scriptElementId = `diy-script-${widget.value.hash}`

  // Remove existing script element
  document.getElementById(scriptElementId)?.remove()

  // Create new script element
  const scriptEl = document.createElement('script')
  scriptEl.type = 'text/javascript'
  scriptEl.textContent = js
  scriptEl.id = scriptElementId
  document.body.appendChild(scriptEl)
}

const resetChanges = (): void => {
  if (!htmlEditor || !cssEditor || !jsEditor) return
  htmlEditor.setValue(widget.value.options.html || defaultOptions.html)
  cssEditor.setValue(widget.value.options.css || defaultOptions.css)
  jsEditor.setValue(widget.value.options.js || defaultOptions.js)
}

const finishEditor = (): void => {
  if (htmlEditor) {
    htmlEditor.dispose()
    htmlEditor = null
  }
  if (cssEditor) {
    cssEditor.dispose()
    cssEditor = null
  }
  if (jsEditor) {
    jsEditor.dispose()
    jsEditor = null
  }
}

const closeDialog = (): void => {
  widgetStore.widgetManagerVars(widget.value.hash).configMenuOpen = false
  finishEditor()
}

onBeforeMount(() => {
  widget.value.options = Object.assign({}, defaultOptions, widget.value.options)
})

onMounted(() => {
  executeUserScript()
})

onBeforeUnmount(() => {
  finishEditor()
})
</script>

<style scoped>
.main {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  min-width: 150px;
  min-height: 200px;
}

.edit-button {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
}

.editor-container {
  width: 100%;
  height: 24vh;
  border: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 1rem;
}

.editor-container:last-child {
  margin-bottom: 0;
}
</style>
