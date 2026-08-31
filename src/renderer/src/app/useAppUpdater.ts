import { getVersion } from '@tauri-apps/api/app'
import { relaunch } from '@tauri-apps/plugin-process'
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater'
import { computed, ref } from 'vue'
import { calculateDownloadProgress, getUpdaterErrorMessage } from './updateHelpers'

export type UpdaterStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'error'
export type UpdateCheckResult = 'available' | 'current' | 'development' | 'busy' | 'error'

export function useAppUpdater() {
  const status = ref<UpdaterStatus>('idle')
  const dialogVisible = ref(false)
  const currentVersion = ref('')
  const nextVersion = ref('')
  const notes = ref('')
  const downloadedBytes = ref(0)
  const totalBytes = ref<number | null>(null)
  const errorMessage = ref('')
  let pendingUpdate: Update | null = null

  const checking = computed(() => status.value === 'checking')
  const updateAvailable = computed(() => pendingUpdate !== null)
  const progressPercent = computed(() => calculateDownloadProgress(downloadedBytes.value, totalBytes.value))
  const operationLocked = computed(() => status.value === 'downloading' || status.value === 'installing')

  async function checkForUpdates(): Promise<UpdateCheckResult> {
    if (checking.value || operationLocked.value) return 'busy'
    if (import.meta.env.DEV) return 'development'

    status.value = 'checking'
    errorMessage.value = ''
    try {
      currentVersion.value = await getVersion()
      const update = await check({ timeout: 15_000 })
      if (!update) {
        if (pendingUpdate) await pendingUpdate.close()
        pendingUpdate = null
        nextVersion.value = ''
        notes.value = ''
        status.value = 'idle'
        return 'current'
      }

      if (pendingUpdate) await pendingUpdate.close()
      pendingUpdate = update
      currentVersion.value = update.currentVersion
      nextVersion.value = update.version
      notes.value = update.body?.trim() || '此版本未提供更新说明。'
      status.value = 'available'
      dialogVisible.value = true
      return 'available'
    } catch (error) {
      errorMessage.value = getUpdaterErrorMessage(error)
      status.value = 'error'
      return 'error'
    }
  }

  function openDialog() {
    if (pendingUpdate) dialogVisible.value = true
  }

  function closeDialog() {
    if (!operationLocked.value) dialogVisible.value = false
  }

  async function installUpdate() {
    if (!pendingUpdate || operationLocked.value) return

    status.value = 'downloading'
    downloadedBytes.value = 0
    totalBytes.value = null
    errorMessage.value = ''
    try {
      await pendingUpdate.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === 'Started') {
          totalBytes.value = event.data.contentLength ?? null
          return
        }
        if (event.event === 'Progress') {
          downloadedBytes.value += event.data.chunkLength
          return
        }
        status.value = 'installing'
      })
      status.value = 'installing'
      await relaunch()
    } catch (error) {
      errorMessage.value = getUpdaterErrorMessage(error)
      status.value = 'error'
      throw error
    }
  }

  async function dispose() {
    if (pendingUpdate && !operationLocked.value) await pendingUpdate.close()
    pendingUpdate = null
  }

  return {
    status,
    dialogVisible,
    currentVersion,
    nextVersion,
    notes,
    downloadedBytes,
    totalBytes,
    errorMessage,
    checking,
    updateAvailable,
    progressPercent,
    operationLocked,
    checkForUpdates,
    openDialog,
    closeDialog,
    installUpdate,
    dispose,
  }
}
