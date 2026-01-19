import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <img
          src="/image.png"
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/35 to-black/70" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/20 via-black/40 to-transparent" />
      </div>

      <header className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <a href="#" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <span className="h-4 w-4 rounded bg-gradient-to-br from-indigo-400 to-fuchsia-400" />
            </span>
            <span className="text-lg">lackecity</span>
          </a>

          <nav className="hidden items-center gap-8 text-sm text-white/80 md:flex">
            <a className="hover:text-white" href="#features">
              How It Works
            </a>
            <a className="hover:text-white" href="#docs">
              About
            </a>
            <a className="hover:text-white" href="#pricing">
              Healthcare Access
            </a>
            <a className="hover:text-white" href="#contact">
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="#login"
              className="hidden rounded-xl px-3 py-2 text-sm font-medium text-white/85 hover:text-white md:inline-flex"
            >
              Log in
            </a>
            <Link
              to="/interaction"
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white/90"
            >
              Tell Symptoms
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto w-full max-w-6xl px-6 pb-16 pt-6 md:pb-20 md:pt-10">
          <div className="flex flex-col">
            {/* Badge - center aligned */}
            <div className="flex justify-center">
              
            </div>

            {/* Headline - center aligned */}
            <h1 className="mt-6 text-center text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
              Right care 
              <span className="block text-4xl text-white sm:text-5xl md:text-6xl lg:text-7xl">
                Right <span className="text-indigo-300">doctor</span>  Right <span className="text-indigo-300">time</span>
              </span>
            </h1>

            {/* Paragraph - center aligned */}
            <p className="mt-6 mx-auto max-w-xl text-center text-sm leading-relaxed text-white/80 sm:text-base md:mt-8">
              Enter your symptoms and get guided to the right specialist, nearby hospitals, and urgency level — without self-diagnosis.
            </p>

            {/* Buttons - center aligned */}
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                to="/interaction"
                className="inline-flex items-center justify-center rounded-2xl bg-indigo-300 px-10 py-4 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 hover:bg-indigo-400"
              >
                Find the Right Doctor
              </Link>
             
            </div>

            {/* Cards - center aligned */}
            <div className="mt-12 mx-auto grid max-w-3xl gap-3 text-center text-sm text-white/75 sm:grid-cols-3 sm:gap-10 md:mt-16">
              <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="font-semibold text-white">AI Triage Routing</div>
                <div className="mt-1">We guide patients to the correct medical specialist based on symptoms</div>
              </div>
              <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="font-semibold text-white">Nearby Hospital Suggestions</div>
                <div className="mt-1">Find the closest hospitals and clinics instantly</div>
              </div>
              <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="font-semibold text-white">Urgency Detection</div>
                <div className="mt-1">Detect the urgency level of your symptoms to prioritize care</div>
              </div>
            </div>
          </div>
        </section>
      </main>

     
    </div>
  )
}
