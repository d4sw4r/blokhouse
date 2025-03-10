import "../globals.css";
import ClientWrapper from "@/components/ClientWrapper";



export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (

        <ClientWrapper>{children}</ClientWrapper>

    );
}
