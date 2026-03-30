export type RootStackParamList = {
  Auth: undefined
  Main: undefined
}

export type RootTabParamList = {
  Inbox: { screen?: string; params?: object }
  Notifications: undefined
}

export type InboxStackParamList = {
  InboxList: undefined
  ConversationDetail: { conversationId: string }
}
