import ClientApp from "@/components/ClientApp";
import IntroSplash from "@/components/IntroSplash";

export const metadata = { title: "Chat" };

export default function Page() {
  return (
    <>
      <ClientApp />
      <IntroSplash path="/chat" />
    </>
  );
}
