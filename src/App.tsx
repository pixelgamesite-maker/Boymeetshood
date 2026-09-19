import { Router as WouterRouter, Route, Switch, Link } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Market from "@/pages/market";
import About from "@/pages/about";
import ComingSoon from "@/pages/coming-soon";

function NotFound() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ background: "var(--ink)" }}
    >
      <img src="/logo.png" alt="" width={72} height={72} className="rounded-[20px]" />
      <p
        className="m-0 mt-6 text-[12px] uppercase"
        style={{ color: "var(--fg-faint)", fontFamily: "var(--mono)", letterSpacing: "0.3em" }}
      >
        404
      </p>
      <h1
        className="m-0 mt-4 font-black leading-[1.02]"
        style={{ fontSize: "clamp(2rem, 6vw, 3rem)", letterSpacing: "-0.025em" }}
      >
        This one isn't in the Hood.
      </h1>
      <p
        className="m-0 mt-4 max-w-[40ch] text-[16px] leading-relaxed"
        style={{ color: "var(--fg-dim)" }}
      >
        The page you're after doesn't exist. Head back and start from the top.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center rounded-full px-8 py-3.5 text-[14.5px] font-extrabold"
        style={{ background: "var(--lime)", color: "var(--ink)" }}
      >
        Back to home
      </Link>
    </div>
  );
}

function App() {
  return (
    <div className="dark">
      <TooltipProvider>
        <WouterRouter>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/p2p" component={Market} />
            <Route path="/about" component={About} />
            <Route path="/pool" component={ComingSoon} />
            <Route path="/treasury" component={ComingSoon} />
            <Route path="/automint" component={ComingSoon} />
            <Route component={NotFound} />
          </Switch>
        </WouterRouter>
      </TooltipProvider>
    </div>
  );
}

export default App;
