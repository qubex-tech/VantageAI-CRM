export type AuthStackParamList = {
  Login: undefined
  ForgotPassword: undefined
  VerifyOTP: { resetToken: string; email: string }
  NewPassword: { resetToken: string; otp: string }
}

export type RootStackParamList = {
  Auth: undefined
  Main: undefined
}

export type RootTabParamList = {
  Inbox: { screen?: string; params?: object }
  Calls: undefined
  Notifications: undefined
}

export type InboxStackParamList = {
  InboxList: undefined
  ConversationDetail: { conversationId: string }
}

export type CallsStackParamList = {
  CallsList: undefined
  CallDetail: { callId: string }
}
