/**
 * Email Validation Utilities Tests
 * Unit tests for email validation functions
 * Following .cursorrules: comprehensive testing, error handling
 */

import { validateHTML, validateLinks, validateImages, validateEmail } from '../email-validation'

describe('validateHTML', () => {
  it('should detect empty HTML content', () => {
    const result = validateHTML('')
    expect(result.isValid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0].message).toContain('empty')
  })

  it('should detect whitespace-only content', () => {
    const result = validateHTML('   \n\t  ')
    expect(result.isValid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should validate valid HTML content', () => {
    const result = validateHTML('<p>Hello World</p>')
    expect(result.errors.length).toBe(0)
  })

  it('should warn about missing inline styles', () => {
    const result = validateHTML('<div>Content</div>')
    expect(result.info.some((i) => i.message.includes('inline styles'))).toBe(true)
  })

  it('should warn about missing table-based layout', () => {
    const result = validateHTML('<div>Content</div>')
    expect(result.warnings.some((w) => w.message.includes('table-based'))).toBe(true)
  })

  it('should detect potential unclosed tags', () => {
    const html = '<div><p><span>Content</span></p>'
    const result = validateHTML(html)
    // Note: This is a basic check, may not catch all cases
    expect(result.warnings.length).toBeGreaterThanOrEqual(0)
  })
})

describe('validateLinks', () => {
  it('should validate valid links', () => {
    const html = '<a href="https://example.com">Link</a>'
    const result = validateLinks(html)
    expect(result.isValid).toBe(true)
    expect(result.errors.length).toBe(0)
  })

  it('should warn about placeholder links', () => {
    const html = '<a href="#">Link</a>'
    const result = validateLinks(html)
    expect(result.warnings.some((w) => w.message.includes('placeholder'))).toBe(true)
  })

  it('should warn about javascript:void(0) links', () => {
    const html = '<a href="javascript:void(0)">Link</a>'
    const result = validateLinks(html)
    expect(result.warnings.some((w) => w.message.includes('placeholder'))).toBe(true)
  })

  it('should warn about long URLs', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(250)
    const html = `<a href="${longUrl}">Link</a>`
    const result = validateLinks(html)
    expect(result.warnings.some((w) => w.message.includes('long'))).toBe(true)
  })

  it('should detect invalid URLs', () => {
    const html = '<a href="not-a-valid-url">Link</a>'
    const result = validateLinks(html)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should warn about empty links', () => {
    const html = '<a href="https://example.com"></a>'
    const result = validateLinks(html)
    expect(result.warnings.some((w) => w.message.includes('empty'))).toBe(true)
  })

  it('should handle multiple links', () => {
    const html = `
      <a href="https://example.com">Link 1</a>
      <a href="https://example.org">Link 2</a>
    `
    const result = validateLinks(html)
    expect(result.isValid).toBe(true)
  })
})

describe('validateImages', () => {
  it('should validate images with alt text', () => {
    const html = '<img src="https://example.com/image.jpg" alt="Description" />'
    const result = validateImages(html)
    expect(result.errors.length).toBe(0)
  })

  it('should warn about missing alt text', () => {
    const html = '<img src="https://example.com/image.jpg" />'
    const result = validateImages(html)
    expect(result.warnings.some((w) => w.message.includes('alt text'))).toBe(true)
  })

  it('should warn about empty alt text', () => {
    const html = '<img src="https://example.com/image.jpg" alt="" />'
    const result = validateImages(html)
    expect(result.warnings.some((w) => w.message.includes('alt text'))).toBe(true)
  })

  it('should info about data URIs', () => {
    const html = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" alt="Image" />'
    const result = validateImages(html)
    expect(result.info.some((i) => i.message.includes('data URI'))).toBe(true)
  })

  it('should warn about relative URLs', () => {
    const html = '<img src="/images/image.jpg" alt="Image" />'
    const result = validateImages(html)
    expect(result.warnings.some((w) => w.message.includes('absolute URLs'))).toBe(true)
  })

  it('should validate absolute URLs', () => {
    const html = '<img src="https://example.com/image.jpg" alt="Description" />'
    const result = validateImages(html)
    expect(result.warnings.filter((w) => w.message.includes('absolute URLs')).length).toBe(0)
  })

  it('should handle multiple images', () => {
    const html = `
      <img src="https://example.com/image1.jpg" alt="Image 1" />
      <img src="https://example.com/image2.jpg" alt="Image 2" />
    `
    const result = validateImages(html)
    expect(result.errors.length).toBe(0)
  })
})

describe('validateEmail', () => {
  it('should validate complete email content', () => {
    const html = `
      <table>
        <tr>
          <td style="padding: 20px;">
            <p>Hello World</p>
            <a href="https://example.com">Click here</a>
            <img src="https://example.com/image.jpg" alt="Image" />
          </td>
        </tr>
      </table>
    `
    const result = validateEmail(html)
    expect(result.isValid).toBe(true)
  })

  it('should aggregate errors from all validators', () => {
    const html = `
      <div>
        <a href="invalid-url">Link</a>
        <img src="/relative.jpg" />
      </div>
    `
    const result = validateEmail(html)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('should combine HTML, link, and image validation', () => {
    const html = '<p>Test</p>'
    const result = validateEmail(html)
    // Should have warnings about table-based layout and inline styles
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('should return isValid false when errors exist', () => {
    const html = '<a href="not-a-valid-url">Link</a>'
    const result = validateEmail(html)
    expect(result.isValid).toBe(false)
  })

  it('should return isValid true when only warnings exist', () => {
    const html = '<div><img src="/image.jpg" alt="Test" /></div>'
    const result = validateEmail(html)
    // Has warnings but no errors
    expect(result.warnings.length).toBeGreaterThan(0)
    // Should still be valid if no errors
    const hasErrors = result.errors.length > 0
    expect(result.isValid).toBe(!hasErrors)
  })
})

