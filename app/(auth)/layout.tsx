
import Logo from "@/components/Logo";




const Layout = ({ children }: { children: React.ReactNode }) => (
    <>
        <div className="flex min-h-screen">
            <section className="w-1/2 hidden items-center justify-center bg-gradient-to-r from-brandSecondary to-brandAccent bg-brandSecondary p-10 lg:flex xl:w-2/5">
                <div className="flex  justify-center">
                    <Logo />
                </div>
            </section>

            <section className="flex flex-1 flex-col items-center justify-center">
                {children}
            </section>
        </div>
    </>
)

export default Layout;