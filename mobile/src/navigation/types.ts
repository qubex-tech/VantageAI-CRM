import type { NavigatorScreenParams } from '@react-navigation/native'

export type AuthStackParamList = {
  Login: undefined
  ForgotPassword: undefined
  VerifyOTP: { resetToken: string; email: string }
  NewPassword: { resetToken: string; otp: string }
  VerifyEmailCode: { loginToken: string; email: string }
}

export type RootStackParamList = {
  Auth: undefined
  Main: undefined
}

export type InboxStackParamList = {
  InboxList: undefined
  ConversationDetail: { conversationId: string }
  NewConversation: undefined
}

export type CallsStackParamList = {
  CallsList: undefined
  CallDetail: { callId: string }
}

export type RootTabParamList = {
  Inbox: NavigatorScreenParams<InboxStackParamList>
  Calls: NavigatorScreenParams<CallsStackParamList>
  Notifications: undefined
  Profile: undefined
}
