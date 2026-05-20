import { ChatView } from "@/components/chat/ChatView";

type ConversationPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ConversationPage({
  params,
}: ConversationPageProps) {
  const { id } = await params;
  return <ChatView conversationId={id} />;
}
