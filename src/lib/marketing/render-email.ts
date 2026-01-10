// Email rendering utilities

import { EmailDoc, BrandProfile, VariableContext, GlobalStyles, Block } from './types'
import { replaceVariables } from './variables'

/**
 * Render email from JSON document structure
 */
export function renderEmailFromJson(
  doc: EmailDoc,
  brandProfile: BrandProfile | null,
  context: VariableContext
): { html: string; text: string } {
  const globalStyles = doc.globalStyles || {}
  
  // Merge brand styles with global styles
  const styles = {
    fontFamily: globalStyles.fontFamily || (brandProfile?.fontFamily as any) || 'Arial',
    primaryColor: globalStyles.primaryColor || brandProfile?.primaryColor || '#2563eb',
    secondaryColor: globalStyles.secondaryColor || brandProfile?.secondaryColor || '#64748b',
    buttonRadius: globalStyles.buttonRadius || '6px',
    buttonColor: globalStyles.buttonColor || globalStyles.primaryColor || brandProfile?.primaryColor || '#2563eb',
    linkColor: globalStyles.linkColor || '#2563eb',
  }
  
  let html = ''
  let text = ''
  
  // Render each row
  for (const row of doc.rows) {
    const { html: rowHtml, text: rowText } = renderRow(row, brandProfile, context, styles)
    html += rowHtml
    text += rowText + '\n\n'
  }
  
  // Wrap in email structure
  const fullHtml = wrapEmailHtml(html, styles, brandProfile)
  const fullText = wrapEmailText(text, brandProfile)
  
  return { html: fullHtml, text: fullText }
}

function renderRow(
  row: { columns: Array<{ blocks: Block[]; width?: number }> },
  brandProfile: BrandProfile | null,
  context: VariableContext,
  styles: GlobalStyles
): { html: string; text: string } {
  let html = '<tr><td>'
  let text = ''
  
  if (row.columns.length === 1) {
    // Single column
    const { html: colHtml, text: colText } = renderColumn(row.columns[0], brandProfile, context, styles)
    html += colHtml
    text += colText
  } else {
    // Multi-column layout (simplified: render sequentially for text)
    html += '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
    for (const col of row.columns) {
      const width = col.width || Math.floor(100 / row.columns.length)
      html += `<td width="${width}%" valign="top">`
      const { html: colHtml, text: colText } = renderColumn(col, brandProfile, context, styles)
      html += colHtml
      html += '</td>'
      text += colText + ' | '
    }
    html += '</tr></table>'
  }
  
  html += '</td></tr>'
  return { html, text }
}

function renderColumn(
  column: { blocks: Block[] },
  brandProfile: BrandProfile | null,
  context: VariableContext,
  styles: GlobalStyles
): { html: string; text: string } {
  let html = ''
  let text = ''
  
  for (const block of column.blocks) {
    const { html: blockHtml, text: blockText } = renderBlock(block, brandProfile, context, styles)
    html += blockHtml
    text += blockText + '\n'
  }
  
  return { html, text }
}

function renderBlock(
  block: Block,
  brandProfile: BrandProfile | null,
  context: VariableContext,
  styles: GlobalStyles
): { html: string; text: string } {
  switch (block.type) {
    case 'header':
      return renderHeaderBlock(block, brandProfile, context, styles)
    case 'text':
      return renderTextBlock(block, context)
    case 'image':
      return renderImageBlock(block, context)
    case 'button':
      return renderButtonBlock(block, context, styles)
    case 'divider':
      return renderDividerBlock(block, styles)
    case 'spacer':
      return renderSpacerBlock(block)
    case 'footer':
      return renderFooterBlock(block, brandProfile, context)
    default:
      return { html: '', text: '' }
  }
}

function renderHeaderBlock(
  block: { content?: string },
  brandProfile: BrandProfile | null,
  context: VariableContext,
  styles: GlobalStyles
): { html: string; text: string } {
  const practiceName = block.content || context.practice?.name || brandProfile?.practiceName || 'Practice'
  const logoUrl = brandProfile?.logoUrl
  const headerLayout = brandProfile?.headerLayout || 'left'
  
  let html = '<div style="padding: 20px 0;">'
  if (logoUrl && headerLayout === 'center') {
    html += `<div style="text-align: center;"><img src="${logoUrl}" alt="${practiceName}" style="max-height: 60px;" /></div>`
  } else if (logoUrl) {
    html += `<img src="${logoUrl}" alt="${practiceName}" style="max-height: 60px; vertical-align: middle; margin-right: 10px;" />`
  }
  html += `<h1 style="font-family: ${styles.fontFamily}; color: ${styles.primaryColor}; margin: 0; display: inline-block;">${practiceName}</h1>`
  html += '</div>'
  
  return { html, text: practiceName + '\n' + '='.repeat(practiceName.length) + '\n' }
}

function renderTextBlock(
  block: { content: string; style?: any },
  context: VariableContext
): { html: string; text: string } {
  const content = replaceVariables(block.content, context)
  const style = block.style || {}
  
  const htmlStyles = [
    `font-size: ${style.fontSize || '16px'}`,
    `color: ${style.color || '#333333'}`,
    `font-weight: ${style.fontWeight || 'normal'}`,
    `text-align: ${style.textAlign || 'left'}`,
    `padding: ${style.padding || '10px 0'}`,
  ].join('; ')
  
  // Convert HTML to plain text (basic)
  const textContent = content.replace(/<[^>]+>/g, '').replace(/\n/g, ' ')
  
  return {
    html: `<p style="${htmlStyles}">${content}</p>`,
    text: textContent,
  }
}

function renderImageBlock(
  block: { url: string; alt?: string; link?: string; style?: any },
  context: VariableContext
): { html: string; text: string } {
  const url = replaceVariables(block.url, context)
  const alt = block.alt || ''
  const link = block.link ? replaceVariables(block.link, context) : null
  const style = block.style || {}
  
  const imgStyle = [
    `width: ${style.width || '100%'}`,
    style.height ? `height: ${style.height}` : '',
    `text-align: ${style.align || 'center'}`,
  ].filter(Boolean).join('; ')
  
  let html = '<div style="' + imgStyle + ';">'
  if (link) {
    html += `<a href="${link}"><img src="${url}" alt="${alt}" style="max-width: 100%; height: auto;" /></a>`
  } else {
    html += `<img src="${url}" alt="${alt}" style="max-width: 100%; height: auto;" />`
  }
  html += '</div>'
  
  return { html, text: `[Image: ${alt || url}]\n` }
}

function renderButtonBlock(
  block: { label: string; url: string; style?: any },
  context: VariableContext,
  styles: GlobalStyles
): { html: string; text: string } {
  const label = replaceVariables(block.label, context)
  const url = replaceVariables(block.url, context)
  const style = block.style || {}
  
  const bgColor = style.backgroundColor || styles.buttonColor
  const textColor = style.textColor || '#ffffff'
  const borderRadius = style.borderRadius || styles.buttonRadius
  const padding = style.padding || '12px 24px'
  
  const html = `
    <div style="text-align: center; padding: 20px 0;">
      <a href="${url}" style="background-color: ${bgColor}; color: ${textColor}; padding: ${padding}; border-radius: ${borderRadius}; text-decoration: none; display: inline-block; font-weight: bold;">${label}</a>
    </div>
  `
  
  return { html, text: `${label}: ${url}\n` }
}

function renderDividerBlock(
  block: { style?: any },
  styles: GlobalStyles
): { html: string; text: string } {
  const style = block.style || {}
  const color = style.color || '#e5e7eb'
  const thickness = style.thickness || '1px'
  
  return {
    html: `<hr style="border: none; border-top: ${thickness} solid ${color}; margin: 20px 0;" />`,
    text: '---\n',
  }
}

function renderSpacerBlock(block: { height: string }): { html: string; text: string } {
  return {
    html: `<div style="height: ${block.height};"></div>`,
    text: '\n',
  }
}

function renderFooterBlock(
  block: { content?: string; showUnsubscribe?: boolean },
  brandProfile: BrandProfile | null,
  context: VariableContext
): { html: string; text: string } {
  let html = '<div style="padding: 20px 0; font-size: 12px; color: #666666; border-top: 1px solid #e5e7eb; margin-top: 40px;">'
  let text = '\n---\n'
  
  const footerContent = block.content || brandProfile?.emailFooterHtml || ''
  
  if (footerContent) {
    const content = replaceVariables(footerContent, context)
    html += content
    text += content.replace(/<[^>]+>/g, '') + '\n'
  } else {
    const practiceName = context.practice?.name || brandProfile?.practiceName || 'Practice'
    const practiceAddress = context.practice?.address || brandProfile?.defaultFromEmail || ''
    
    html += `<p>${practiceName}</p>`
    text += `${practiceName}\n`
    
    if (practiceAddress) {
      html += `<p>${practiceAddress}</p>`
      text += `${practiceAddress}\n`
    }
  }
  
  if (block.showUnsubscribe !== false) {
    html += '<p><a href="{{unsubscribe_url}}" style="color: #666666;">Unsubscribe</a></p>'
    text += 'Unsubscribe: {{unsubscribe_url}}\n'
  }
  
  html += '</div>'
  return { html, text }
}

function wrapEmailHtml(content: string, styles: GlobalStyles, brandProfile: BrandProfile | null): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: ${styles.fontFamily}, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          ${content}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

function wrapEmailText(content: string, brandProfile: BrandProfile | null): string {
  const practiceName = brandProfile?.practiceName || 'Practice'
  return `${practiceName}\n\n${content}\n\n---\nThis is an automated message.`
}
