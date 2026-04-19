import Tetris from './components/Tetris';

export default function App() {
  return (
    <div className="h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      <main className="w-full h-full flex flex-col items-center justify-center">
        <Tetris />
      </main>
    </div>
  );
}
