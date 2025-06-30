import express from 'express'
import type { Server } from 'http'
import { v4 as uuidv4 } from 'uuid'

/**
 * Mock Vehicle Service that simulates ArduPilot/BlueOS vehicle
 */
export class MockVehicleService {
  private storage: Record<string, any> = {}
  private vehicleId: string
  private server: Server | null = null
  private port = 0

  /**
   * Constructor for MockVehicleService
   * @param vehicleId - Optional vehicle ID, will generate UUID if not provided
   */
  constructor(vehicleId?: string) {
    this.vehicleId = vehicleId || uuidv4()
  }

  /**
   * Start the mock vehicle service
   * @returns Promise resolving to the vehicle address
   */
  async start(): Promise<string> {
    const app = express()
            // Use raw body parsing to handle malformed JSON properly
    app.use(express.raw({ limit: '50mb', type: '*/*' }))

    // Custom JSON parsing middleware
    app.use((req: any, res: any, next: any) => {
      if (req.body && req.body.length > 0) {
        try {
          const bodyString = req.body.toString('utf8')
          console.log(`[MockVehicle ${this.vehicleId}] Raw body string:`, bodyString)
          req.body = JSON.parse(bodyString)
        } catch (error) {
          console.log(`[MockVehicle ${this.vehicleId}] JSON parse error:`, error)
          console.log(`[MockVehicle ${this.vehicleId}] Raw body bytes:`, req.body)
          // Try to handle malformed JSON gracefully
          const bodyString = req.body.toString('utf8')
          if (bodyString.startsWith('"') && bodyString.endsWith('"')) {
            // It's a quoted string, extract the content
            req.body = bodyString.slice(1, -1)
          } else {
            req.body = bodyString
          }
        }
      }
      next()
    })

    // Add CORS headers to allow browser requests
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      if (req.method === 'OPTIONS') {
        res.sendStatus(200)
      } else {
        next()
      }
    })

    // GET endpoint for bag/v1.0/get/* - retrieve data from vehicle
    app.get('/bag/v1.0/get/cockpit/:path(*)', (req, res) => {
      const path = req.params.path
      console.log(`[MockVehicle ${this.vehicleId}] GET cockpit/${path}`)

      if (path === 'cockpit-vehicle-id') {
        // Only return vehicle ID if it has been explicitly stored
        // This simulates real vehicle behavior where no ID exists initially
        const storedVehicleId = this.storage['cockpit-vehicle-id']
        if (storedVehicleId) {
          return res.json(storedVehicleId)
        } else {
          return res.status(404).json({ detail: 'Invalid path' })
        }
      }

      const data = this.storage[path]

      // Return stored data if it exists
      if (data !== undefined) {
        return res.json(data)
      }

      // Return empty object for missing paths that settings manager expects
      if (path === 'settings' || path === 'old-style-settings') {
        return res.json({})
      }

      // For other missing paths, return 404
      return res.status(404).json({ detail: 'Invalid path' })
    })

    // POST endpoint for bag/v1.0/set/* - store data on vehicle
    app.post('/bag/v1.0/set/cockpit/:path(*)', (req, res) => {
      const path = req.params.path
      const data = req.body
      console.log(`[MockVehicle ${this.vehicleId}] SET cockpit/${path}`)
      console.log(`[MockVehicle ${this.vehicleId}] Raw body type: ${typeof data}`)
      console.log(`[MockVehicle ${this.vehicleId}] Raw body content:`, JSON.stringify(data))

      this.storage[path] = data
      res.json({ success: true })
    })

    // PUT endpoint for direct /settings access (for clean tests)
    app.put('/settings', (req, res) => {
      const { user, data } = req.body
      console.log(`[MockVehicle ${this.vehicleId}] PUT /settings for user ${user}`)

      if (!this.storage.settings) {
        this.storage.settings = {}
      }
      this.storage.settings[user] = data

      res.json({ success: true })
    })

    return new Promise((resolve, reject) => {
      this.server = app.listen(0, 'localhost', () => {
        const address = this.server!.address()
        if (address && typeof address === 'object') {
          this.port = address.port
          const url = `localhost:${this.port}`
          console.log(`[MockVehicle ${this.vehicleId}] Started on ${url}`)
          resolve(url)
        } else {
          reject(new Error('Failed to get server address'))
        }
      })
    })
  }

  /**
   * Stop the mock vehicle service
   * @returns Promise that resolves when stopped
   */
  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          console.log(`[MockVehicle ${this.vehicleId}] Stopped`)
          resolve()
        })
      })
    }
  }

  /**
   * Set vehicle settings for a user
   * @param userId - The user ID
   * @param settings - The settings to store
   */
  setVehicleSettings(userId: string, settings: Record<string, any>): void {
    if (!this.storage.settings) {
      this.storage.settings = {}
    }
    this.storage.settings[userId] = settings
    console.log(`[MockVehicle ${this.vehicleId}] Set settings for user ${userId}`)
  }

  /**
   * Set old-style vehicle settings
   * @param settings - The old-style settings to store
   */
  setOldStyleVehicleSettings(settings: Record<string, any>): void {
    this.storage['old-style-settings'] = settings
    console.log(`[MockVehicle ${this.vehicleId}] Set old-style settings`)
  }

  /**
   * Get vehicle settings
   * @returns The vehicle settings
   */
  getVehicleSettings(): Record<string, any> {
    return this.storage.settings || {}
  }

  /**
   * Get the vehicle ID
   * @returns The vehicle ID
   */
  getVehicleId(): string {
    return this.vehicleId
  }

  /**
   * Get all storage contents
   * @returns All stored data
   */
  getAllStorage(): Record<string, any> {
    return { ...this.storage }
  }

  /**
   * Clear all storage
   */
  clearStorage(): void {
    this.storage = {}
  }
}
