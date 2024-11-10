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
    <v-card class="pa-2" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title>Do It Yourself widget configuration</v-card-title>
      <v-card-text>
        <div ref="editorContainer" class="editor-container" />
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
  </v-dialog>
</template>

<script setup lang="ts">
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { computed, nextTick, onBeforeMount, onBeforeUnmount, ref, toRefs } from 'vue'

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
const editorContainer = ref<HTMLElement | null>(null)
const codeContainer = ref<HTMLElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null

const defaultOptions = {
  code: `<!-- Write your HTML code here -->
<!-- You can include JavaScript using script tags -->
<script>
  // Your JavaScript code here
<\/script>`,
}

const compiledCode = computed(() => widget.value.options.code || defaultOptions.code)

const initEditor = async (): Promise<void> => {
  if (editor || !editorContainer.value) return

  editor = monaco.editor.create(editorContainer.value, {
    value: widget.value.options.code || defaultOptions.code,
    language: 'html',
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

const handleDialogOpen = async () => {
  await initEditor()
}

const handleDialogClose = async () => {
  finishEditor()
}

const applyChanges = (): void => {
  if (!editor) return
  widget.value.options.code = editor.getValue()
  executeUserScript()
}

const executeUserScript = (): void => {
  // Extract script content using regex
  const scriptContent = widget.value.options.code.match(/<script>([\s\S]*?)<\/script>/)?.[1] || ''

  console.log('scriptContent')
  console.log(scriptContent)

  // Create script element
  const scriptEl = document.createElement('script')
  scriptEl.type = 'text/javascript'
  scriptEl.textContent = scriptContent
  document.body.appendChild(scriptEl)
}

const resetChanges = (): void => {
  if (!editor) return
  editor.setValue(widget.value.options.code)
}

const finishEditor = (): void => {
  if (!editor) return
  editor.dispose()
  editor = null
}

const closeDialog = (): void => {
  widgetStore.widgetManagerVars(widget.value.hash).configMenuOpen = false
  finishEditor()
}

onBeforeMount(() => {
  widget.value.options = Object.assign({}, defaultOptions, widget.value.options)
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
  height: 70vh;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
