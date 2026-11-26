import ClientWrapper from "@/components/ClientWrapper";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return <ClientWrapper>{children}</ClientWrapper>;
}
