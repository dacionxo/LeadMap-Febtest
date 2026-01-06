/**
 * List Management Tests
 * 
 * Comprehensive tests for list management utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { ListManager, createListManager } from '@/lib/email/james/lists/list-management'

describe('List Manager', () => {
  let manager: ListManager

  beforeEach(() => {
    manager = createListManager()
  })

  describe('createList', () => {
    it('should create email list', () => {
      const list = manager.createList('Test List', 'Test description')
      expect(list.name).toBe('Test List')
      expect(list.description).toBe('Test description')
      expect(list.subscriberCount).toBe(0)
      expect(list.active).toBe(true)
    })
  })

  describe('addSubscriber', () => {
    it('should add subscriber to list', () => {
      const list = manager.createList('Test List')
      const subscriber = manager.addSubscriber(list.id, 'user@example.com')

      expect(subscriber.email).toBe('user@example.com')
      expect(subscriber.listId).toBe(list.id)
      expect(subscriber.status).toBe('active')

      const updatedList = manager.getList(list.id)
      expect(updatedList?.subscriberCount).toBe(1)
    })

    it('should not add unsubscribed email', () => {
      const list = manager.createList('Test List')
      manager.unsubscribe('user@example.com', list.id)

      expect(() => {
        manager.addSubscriber(list.id, 'user@example.com')
      }).toThrow()
    })
  })

  describe('unsubscribe', () => {
    it('should unsubscribe email from list', () => {
      const list = manager.createList('Test List')
      manager.addSubscriber(list.id, 'user@example.com')

      const record = manager.unsubscribe('user@example.com', list.id, 'user_request')
      expect(record.email).toBe('user@example.com')
      expect(record.reason).toBe('user_request')
      expect(manager.isUnsubscribed('user@example.com', list.id)).toBe(true)
    })

    it('should unsubscribe from all lists', () => {
      const list1 = manager.createList('List 1')
      const list2 = manager.createList('List 2')
      manager.addSubscriber(list1.id, 'user@example.com')
      manager.addSubscriber(list2.id, 'user@example.com')

      manager.unsubscribe('user@example.com', undefined, 'user_request')
      expect(manager.isUnsubscribed('user@example.com')).toBe(true)
    })
  })

  describe('generateUnsubscribeUrl', () => {
    it('should generate unsubscribe URL', () => {
      const url = manager.generateUnsubscribeUrl('user@example.com', 'list-1', 'https://example.com')
      expect(url).toContain('/api/emails/unsubscribe')
      expect(url).toContain('token=')
    })
  })
})

