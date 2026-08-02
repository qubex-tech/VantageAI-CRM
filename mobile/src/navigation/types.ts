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

export type AriaStackParamList = {
  AriaHome: undefined
  AriaPatientPicker: undefined
  AriaCapture: {
    sessionId: string
    patientName: string
    visitType?: string | null
  }
  AriaRingListen: {
    sessionId: string
    patientName: string
    visitType?: string | null
  }
  AriaReview: { sessionId: string }
  AriaSigned: { sessionId: string }
}

export type PatientsStackParamList = {
  PatientsSearch: undefined
  PatientDetail: {
    patientId: string
    patientName?: string
  }
}

export type RootTabParamList = {
  Inbox: NavigatorScreenParams<InboxStackParamList>
  Patients: NavigatorScreenParams<PatientsStackParamList>
  Calls: NavigatorScreenParams<CallsStackParamList>
  Aria?: NavigatorScreenParams<AriaStackParamList>
  Notifications: undefined
  Profile: undefined
}
