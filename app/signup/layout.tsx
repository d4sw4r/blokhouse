// app/layout.tsx

import ClientWrapper from "@/components/ClientWrapperNoNav";

export const metadata = {
    title: "Blokhouse",
    description: "A CMDB application for your infrastructure",
    icons: {
        icon: "/favicon.ico",
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <ClientWrapper>{children}</ClientWrapper>
            </body>
        </html>
    );
}
