/**
 * Context Menu Item
 */
export interface ContextMenuItem {
  /**
   * The item name to display
   */
  item: string
  /**
   * The icon to display
   */
  icon?: string
  /**
   * The action to perform
   */
  action: () => void
}
