import { ChatView } from "@/components/chat/ChatView";
import { getAvailableProviders } from "@/lib/providers/config";

type ConversationPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ConversationPage({
  params,
}: ConversationPageProps) {
  const { id } = await params;
  const availableProviders = getAvailableProviders();
  return (
    <ChatView conversationId={id} availableProviders={availableProviders} />
  );
}
