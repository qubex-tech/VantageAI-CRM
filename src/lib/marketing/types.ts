// Marketing Module Type Definitions

import type { BrandProfile as PrismaBrandProfile } from '@prisma/client'

export type TemplateChannel = 'email' | 'sms'
export type BrandProfile = PrismaBrandProfile
export type TemplateCategory = 'reminder' | 'confirmation' | 'reactivation' | 'followup' | 'reviews' | 'broadcast' | 'custom'
export type TemplateStatus = 'draft' | 'published' | 'archived'
export type EditorType = 'dragdrop' | 'html' | 'plaintext'
export type FontFamily = 'Arial' | 'Helvetica' | 'Georgia' | 'Times New Roman' | 'Courier New'
export type HeaderLayout = 'left' | 'center'
export type ActorType = 'staff' | 'agent' | 'system'

// Email Builder JSON Schema
export interface EmailDoc {
  rows: Row[]
  globalStyles?: GlobalStyles
}

export interface Row {
  id?: string
  columns: Column[]
  style?: {
    backgroundColor?: string
    backgroundImage?: string
    backgroundSize?: 'cover' | 'contain' | 'auto'
    backgroundPosition?: string
    padding?: string
    margin?: string
  }
}

export interface Column {
  id?: string
  width?: number // Percentage (1-100) for multi-column layouts
  blocks: Block[]
}

export type Block =
  | HeaderBlock
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock
  | FooterBlock
  | SocialLinksBlock
  | VideoBlock
  | HtmlBlock
  | ProductBlock

export interface HeaderBlock {
  type: 'header'
  content?: string // Override practice name
  logo?: boolean // Show logo
}

export interface TextBlock {
  type: 'text'
  content: string // Rich text HTML or plain text
  style?: {
    fontSize?: string
    color?: string
    fontWeight?: string
    textAlign?: 'left' | 'center' | 'right'
    padding?: string
  }
}

export interface ImageBlock {
  type: 'image'
  url: string
  alt?: string
  link?: string
  style?: {
    width?: string
    height?: string
    align?: 'left' | 'center' | 'right'
  }
}

export interface ButtonBlock {
  type: 'button'
  label: string
  url: string
  style?: {
    backgroundColor?: string
    textColor?: string
    borderRadius?: string
    padding?: string
  }
}

export interface DividerBlock {
  type: 'divider'
  style?: {
    color?: string
    thickness?: string
  }
}

export interface SpacerBlock {
  type: 'spacer'
  height: string // e.g., "20px"
}

export interface FooterBlock {
  type: 'footer'
  content?: string // Override footer
  showUnsubscribe?: boolean
}

export interface SocialLinksBlock {
  type: 'social'
  links: Array<{
    platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'youtube' | 'custom'
    url: string
    icon?: string // Custom icon URL
  }>
  style?: {
    align?: 'left' | 'center' | 'right'
    iconSize?: string
    spacing?: string
  }
}

export interface VideoBlock {
  type: 'video'
  url: string
  thumbnail?: string
  alt?: string
  style?: {
    width?: string
    height?: string
    align?: 'left' | 'center' | 'right'
  }
}

export interface HtmlBlock {
  type: 'html'
  content: string // Raw HTML code
  style?: {
    padding?: string
  }
}

export interface ProductBlock {
  type: 'product'
  productId?: string
  name: string
  description?: string
  imageUrl?: string
  price?: string
  buttonLabel?: string
  buttonUrl?: string
  style?: {
    layout?: 'horizontal' | 'vertical'
    imageAlign?: 'left' | 'right' | 'top'
  }
}

export interface GlobalStyles {
  fontFamily?: FontFamily
  primaryColor?: string
  secondaryColor?: string
  buttonRadius?: string
  buttonColor?: string
  linkColor?: string
}

// Variable Context
export interface VariableContext {
  patient?: {
    firstName?: string
    lastName?: string
    preferredName?: string
  }
  practice?: {
    name?: string
    phone?: string
    address?: string
  }
  appointment?: {
    date?: string
    time?: string
    location?: string
    providerName?: string
  }
  links?: {
    confirm?: string
    reschedule?: string
    cancel?: string
  }
}

// Template Lint Result
export interface LintResult {
  isValid: boolean
  errors: LintError[]
  warnings: LintWarning[]
}

export interface LintError {
  field: string
  message: string
  severity: 'error'
}

export interface LintWarning {
  field: string
  message: string
  severity: 'warning'
}

// Provider Interfaces
export interface EmailProvider {
  sendEmail(params: {
    to: string
    from: string
    fromName?: string
    replyTo?: string
    subject: string
    html: string
    text?: string
  }): Promise<{ success: boolean; messageId?: string; error?: string }>
}

export interface SmsProvider {
  sendSms(params: {
    to: string
    from: string
    message: string
  }): Promise<{ success: boolean; messageId?: string; error?: string }>
}

// Rendering Result
export interface RenderResult {
  html?: string
  text?: string
  variablesFound: string[]
  lintResult?: LintResult
}
