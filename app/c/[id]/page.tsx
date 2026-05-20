import { ChatView } from "@/components/chat/ChatView";

interface ConversationPageProps {
  params: { id: string };
}

export default function ConversationPage({ params }: ConversationPageProps) {
  return <ChatView conversationId={params.id} />;
}
