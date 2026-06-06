// Cloud Sync Module - Hybrid Local/Cloud Storage
// Uses Supabase for cloud storage with localStorage fallback

class CloudSync {
  constructor() {
    this.isOnline = navigator.onLine
    this.syncQueue = []
    this.lastSyncTime = null
    this.supabaseClient = null
    this.syncInterval = null
    this.lastCloudUpdate = null
    this.isSyncing = false

    window.addEventListener("online", () => {
      console.log("[CloudSync] Back online - syncing data...")
      this.isOnline = true
      this.syncLocalChangesFirst()
    })

    window.addEventListener("offline", () => {
      console.log("[CloudSync] Gone offline - using local storage")
      this.isOnline = false
    })

    this.initSupabase()
    this.startAutoSync()
  }

  initSupabase() {
    const savedConfig = localStorage.getItem("supabaseConfig")
    let url, key

    if (savedConfig) {
      const config = JSON.parse(savedConfig)
      url = config.url
      key = config.key
    }

    if (url && key && key !== "YOUR_SUPABASE_ANON_KEY_HERE") {
      try {
        this.supabaseClient = {
          url: url,
          key: key,
          ready: true,
        }
        console.log("[CloudSync] Supabase initialized - cloud sync enabled")

        if (this.isOnline) {
          this.loadAllCloudData()
        }
      } catch (error) {
        console.error("[CloudSync] Supabase init failed:", error)
        this.supabaseClient = null
      }
    }
  }

  async loadAllCloudData() {
    try {
      const hasLocalChanges = localStorage.getItem("hasLocalChanges") === "true"
      if (hasLocalChanges) return false

      const localData = localStorage.getItem("shopManagerState")
      const localDataObj = localData ? JSON.parse(localData) : null
      const cloudData = await this.loadFromCloud("shopManagerState")

      if (cloudData) {
        const cloudModified = cloudData.lastModified || 0
        const localModified = localDataObj?.lastModified || 0

        if (cloudModified > localModified) {
          localStorage.setItem("shopManagerState", JSON.stringify(cloudData))
          window.dispatchEvent(new CustomEvent("cloudDataUpdated"))
          return true
        }
      }
      return false
    } catch (error) {
      console.error("[CloudSync] Failed to load data from cloud:", error)
      return false
    }
  }

  startAutoSync() {
    this.syncInterval = setInterval(async () => {
      if (this.isOnline && this.supabaseClient?.ready && !this.isSyncing) {
        const hasLocalChanges = localStorage.getItem("hasLocalChanges") === "true"

        if (hasLocalChanges) {
          const localData = localStorage.getItem("shopManagerState")
          if (localData) {
            const state = JSON.parse(localData)
            await this.uploadToSupabase("shopManagerState", state)
            localStorage.removeItem("hasLocalChanges")
          }
        }

        if (this.syncQueue.length > 0) {
          await this.syncToCloud()
        }

        if (!hasLocalChanges) {
          await this.checkForCloudUpdates()
        }

        await this.syncCurrentState()
      }
    }, 5000)
  }

  async syncCurrentState() {
    if (this.isSyncing) return

    try {
      this.isSyncing = true
      const localData = localStorage.getItem("shopManagerState")
      if (localData) {
        const state = JSON.parse(localData)
        const cloudData = await this.loadFromCloud("shopManagerState")

        if (cloudData && this.lastCloudUpdate) {
          const localUpdateTime = state.lastModified || 0
          if (this.lastCloudUpdate > localUpdateTime) {
            this.isSyncing = false
            return
          }
        }

        state.lastModified = Date.now()
        localStorage.setItem("shopManagerState", JSON.stringify(state))
        await this.uploadToSupabase("shopManagerState", state)
      }
    } catch (error) {
      console.error("[CloudSync] Failed to auto-sync:", error)
    } finally {
      this.isSyncing = false
    }
  }

  async checkForCloudUpdates() {
    if (this.isSyncing) return false

    const hasLocalChanges = localStorage.getItem("hasLocalChanges") === "true"
    if (hasLocalChanges) return false

    try {
      this.isSyncing = true
      const cloudData = await this.loadFromCloud("shopManagerState")
      if (cloudData) {
        const localData = localStorage.getItem("shopManagerState")
        const local = localData ? JSON.parse(localData) : null
        const cloudModified = cloudData.lastModified || 0
        const localModified = local?.lastModified || 0

        if (cloudModified > localModified) {
          this.lastCloudUpdate = cloudModified
          localStorage.setItem("shopManagerState", JSON.stringify(cloudData))
          window.dispatchEvent(new CustomEvent("cloudDataUpdated", { detail: cloudData }))
          this.isSyncing = false
          return true
        }
      }
      this.isSyncing = false
      return false
    } catch (error) {
      console.error("[CloudSync] Failed to check cloud updates:", error)
      this.isSyncing = false
      return false
    }
  }

  async saveData(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch (e) {
      console.error("[CloudSync] Failed to save to localStorage:", e)
    }

    if (this.isOnline && this.supabaseClient?.ready) {
      await this.syncToCloud(key, data)
    } else {
      this.addToSyncQueue(key, data)
    }
  }

  async loadData(key) {
    if (this.isOnline && this.supabaseClient?.ready) {
      try {
        const cloudData = await this.loadFromCloud(key)
        if (cloudData) {
          localStorage.setItem(key, JSON.stringify(cloudData))
          return cloudData
        }
      } catch (error) {
        console.log("[CloudSync] Cloud load failed, using local:", error.message)
      }
    }

    const localData = localStorage.getItem(key)
    if (localData) return JSON.parse(localData)
    return null
  }

  async syncToCloud(key = null, data = null) {
    if (!this.supabaseClient?.ready) return
    if (!this.isOnline) return

    try {
      if (key && data) {
        await this.uploadToSupabase(key, data)
        this.lastSyncTime = new Date().toISOString()
        return
      }

      while (this.syncQueue.length > 0) {
        const item = this.syncQueue.shift()
        await this.uploadToSupabase(item.key, item.data)
      }

      this.lastSyncTime = new Date().toISOString()
    } catch (error) {
      console.error("[CloudSync] Cloud sync failed:", error)
      throw error
    }
  }

  async uploadToSupabase(key, data) {
    try {
      const storageId = this.getStorageId()

      const existsResponse = await fetch(
        `${this.supabaseClient.url}/rest/v1/shop_data?storage_id=eq.${storageId}&select=storage_id`,
        {
          headers: {
            apikey: this.supabaseClient.key,
            Authorization: `Bearer ${this.supabaseClient.key}`,
          },
        }
      )

      const existingRecords = await existsResponse.json()
      const recordExists = existingRecords && existingRecords.length > 0

      const payload = {
        storage_id: storageId,
        data: data,
        updated_at: new Date().toISOString(),
      }

      if (recordExists) {
        const response = await fetch(`${this.supabaseClient.url}/rest/v1/shop_data?storage_id=eq.${storageId}`, {
          method: "PATCH",
          headers: {
            apikey: this.supabaseClient.key,
            Authorization: `Bearer ${this.supabaseClient.key}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }
      } else {
        const response = await fetch(`${this.supabaseClient.url}/rest/v1/shop_data`, {
          method: "POST",
          headers: {
            apikey: this.supabaseClient.key,
            Authorization: `Bearer ${this.supabaseClient.key}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }
      }
    } catch (error) {
      console.error("[CloudSync] Upload failed:", error)
      throw error
    }
  }

  async loadFromCloud(key) {
    try {
      const storageId = this.getStorageId()

      const response = await fetch(
        `${this.supabaseClient.url}/rest/v1/shop_data?storage_id=eq.${storageId}&select=data,updated_at`,
        {
          headers: {
            apikey: this.supabaseClient.key,
            Authorization: `Bearer ${this.supabaseClient.key}`,
          },
        }
      )

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const results = await response.json()
      if (results && results.length > 0) {
        return results[0].data
      }
      return null
    } catch (error) {
      console.error("[CloudSync] Load from cloud failed:", error)
      throw error
    }
  }

  addToSyncQueue(key, data) {
    this.syncQueue = this.syncQueue.filter((item) => item.key !== key)
    this.syncQueue.push({ key, data, timestamp: Date.now() })
  }

  getStorageId() {
    return "shared_shop_storage"
  }

  getStatus() {
    return {
      online: this.isOnline,
      cloudConfigured: this.supabaseClient?.ready || false,
      queuedItems: this.syncQueue.length,
      lastSync: this.lastSyncTime,
    }
  }

  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }
  }

  async syncLocalChangesFirst() {
    try {
      const hasLocalChanges = localStorage.getItem("hasLocalChanges") === "true"

      if (hasLocalChanges) {
        const localData = localStorage.getItem("shopManagerState")
        if (localData) {
          const state = JSON.parse(localData)
          await this.uploadToSupabase("shopManagerState", state)
          localStorage.removeItem("hasLocalChanges")
        }
      }

      if (this.syncQueue.length > 0) {
        await this.syncToCloud()
      }

      await this.checkForCloudUpdates()
    } catch (error) {
      console.error("[CloudSync] Failed to sync local changes:", error)
    }
  }
}

window.cloudSync = new CloudSync()
