export interface InboxAckParams {
  projectName: string;
}

export interface InboxAckResult {
  status: "acknowledged";
  lastProcessed: string;
}

export interface InboxAckUseCase {
  inboxAck(params: InboxAckParams): Promise<InboxAckResult>;
}
