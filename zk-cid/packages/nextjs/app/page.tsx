import Link from "next/link";
import type { NextPage } from "next";
import { BeakerIcon, BugAntIcon, FingerPrintIcon, RocketLaunchIcon, ScaleIcon } from "@heroicons/react/24/outline";

const entries = [
  {
    href: "/zk-cid",
    icon: <RocketLaunchIcon className="h-8 w-8" />,
    title: "Main Demo",
    desc: "Full flow in one page: create identity, issue credential, generate ZK proof, mint AccessNFT.",
    badge: "Start here",
  },
  {
    href: "/demo",
    icon: <ScaleIcon className="h-8 w-8" />,
    title: "Privacy Comparison",
    desc: "Traditional Web3 KYC vs. zero-knowledge identity: what the verifier actually sees.",
  },
  {
    href: "/zk-test",
    icon: <BeakerIcon className="h-8 w-8" />,
    title: "ZK Engine Test",
    desc: "Pure front-end Semaphore flow: identity → group → proof → verification.",
  },
  {
    href: "/debug",
    icon: <BugAntIcon className="h-8 w-8" />,
    title: "Debug Contracts",
    desc: "Inspect and call ComplianceGate & AccessNFT directly.",
  },
];

const Home: NextPage = () => {
  return (
    <div className="flex flex-col items-center grow pt-10 px-5 pb-16">
      <div className="text-center max-w-2xl">
        <div className="flex justify-center mb-4">
          <FingerPrintIcon className="h-14 w-14 text-secondary" />
        </div>
        <h1 className="text-5xl font-bold mb-4">ZK-CID</h1>
        <p className="text-xl opacity-80">
          Zero-Knowledge Compliance Identity — prove you are KYC-compliant on-chain without revealing who you are.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12 w-full max-w-6xl">
        {entries.map(({ href, icon, title, desc, badge }) => (
          <Link key={href} href={href} passHref className="group">
            <div className="bg-base-100 border border-base-300 rounded-2xl p-6 h-full shadow-sm transition-shadow group-hover:shadow-md">
              <div className="flex items-center justify-between mb-3">
                <span className="text-secondary">{icon}</span>
                {badge && <span className="badge badge-outline badge-sm">{badge}</span>}
              </div>
              <h2 className="text-lg font-bold mb-1">{title}</h2>
              <p className="text-sm opacity-70">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Home;
