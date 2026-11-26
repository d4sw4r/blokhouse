import { LogoMark } from "@/components/shell/Logo";
import "../globals.css";

const Layout = ({ children }: { children: React.ReactNode }) => (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-10 text-text">
        <div className="mb-6 flex items-center gap-2.5">
            <LogoMark size={32} />
            <span className="font-mono text-xl font-medium text-text">blokhouse</span>
        </div>
        <div className="w-full max-w-sm">{children}</div>
    </div>
);

export default Layout;
