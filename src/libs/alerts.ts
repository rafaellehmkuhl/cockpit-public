import { sleep } from './utils'

export type Alert = {
  /**
   * The message to display
   */
  message: string
  /**
   * The variant of the alert
   */
  variant: 'error' | 'info' | 'warning' | 'critical'
  /**
   * The time to display the alert for, in milliseconds
   */
  timer?: number
}

const alertListeners: ((alert: Alert) => void)[] = []

/**
 * Listen for alerts
 * @param {((alert: Alert) => void)} listener The listener to add
 */
export const listenForAlerts = (listener: (alert: Alert) => void): void => {
  alertListeners.push(listener)
}

/**
 * Notify listeners that there are new alerts to display
 * @param {Alert} alert The alert to notify listeners about
 */
export const notifyAlertListeners = (alert: Alert): void => {
  alertListeners.forEach((listener) => {
    listener(alert)
  })
}

/**
 * Push an alert to the list of pending alerts
 * @param {Alert} alert The alert to push
 */
export const pushAlert = async (alert: Alert): Promise<void> => {
  notifyAlertListeners(alert)
  await sleep(alert.timer ?? 0)
}
