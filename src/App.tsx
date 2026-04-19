import Tetris from './components/Tetris';

export default function App() {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-blue-500/5 blur-[80px] rounded-full" />
      </div>

      <header className="z-10 mb-4 md:mb-8 text-center px-4">
        <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white italic uppercase">
          Cyber <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">Tetris</span>
        </h1>
        <p className="text-white/30 font-mono text-[10px] md:text-xs uppercase tracking-[0.2em] md:tracking-[0.3em] mt-2">Neural Link Established // System Ready</p>
      </header>

      <main className="z-10 w-full max-w-5xl">
        <Tetris />
      </main>

      <footer className="z-10 mt-12 text-white/20 font-mono text-[10px] uppercase tracking-widest">
        &copy; 2026 Cyber-Grid Systems // v1.0.4
      </footer>
    </div>
  );
}
