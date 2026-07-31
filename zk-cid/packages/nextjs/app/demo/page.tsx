import { NextPage } from "next";

const DemoPage: NextPage = () => {
  return (
    <>
      <div className="flex items-center flex-col flex-grow pt-10">
        <div className="px-5">
          <h1 className="text-center">
            <span className="block text-4xl font-bold mb-4">Privacy Comparison</span>
            <span className="block text-2xl mb-8">Traditional Web3 vs. Zero-Knowledge Identity</span>
          </h1>

          <div className="flex flex-col md:flex-row gap-8 mt-8">
            {/* Traditional Web3 Side */}
            <div className="flex-1 bg-base-200 p-6 rounded-3xl border-2 border-red-500">
              <h2 className="text-2xl font-bold mb-4 text-red-500">Traditional Identity (Web3)</h2>
              <div className="space-y-4 text-left">
                <p>
                  <strong>Method:</strong> Wallet Signature or KYC Soulbound Token
                </p>
                <div className="bg-base-100 p-4 rounded-xl border border-red-300">
                  <h3 className="font-bold text-red-500 mb-2">Exposed to Verifier:</h3>
                  <ul className="list-disc list-inside text-sm">
                    <li className="text-red-500 font-bold bg-red-100 px-2 py-1 rounded inline-block mb-1">
                      0xYourWalletAddress...
                    </li>
                    <br />
                    <li className="text-red-500 font-bold bg-red-100 px-2 py-1 rounded inline-block mb-1">
                      Complete Transaction History
                    </li>
                    <br />
                    <li className="text-red-500 font-bold bg-red-100 px-2 py-1 rounded inline-block mb-1">
                      Total Account Balance
                    </li>
                    <br />
                    <li>Link to real-world identity (if KYC SBT)</li>
                  </ul>
                </div>
                <p className="text-sm mt-4 italic">
                  The verifier knows exactly who you are and everything you have done on-chain.
                </p>
              </div>
            </div>

            {/* ZKP Side */}
            <div className="flex-1 bg-base-200 p-6 rounded-3xl border-2 border-green-500">
              <h2 className="text-2xl font-bold mb-4 text-green-500">ZK-CID (Zero-Knowledge)</h2>
              <div className="space-y-4 text-left">
                <p>
                  <strong>Method:</strong> Semaphore Zero-Knowledge Proof
                </p>
                <div className="bg-base-100 p-4 rounded-xl border border-green-300">
                  <h3 className="font-bold text-green-500 mb-2">Exposed to Verifier:</h3>
                  <ul className="list-disc list-inside text-sm">
                    <li className="text-green-600 font-bold bg-green-100 px-2 py-1 rounded inline-block mb-1">
                      Proof: Valid
                    </li>
                    <br />
                    <li className="text-green-600 font-bold bg-green-100 px-2 py-1 rounded inline-block mb-1">
                      Nullifier Hash: 0x8f2... (Anti-replay)
                    </li>
                    <br />
                    <li className="text-gray-500 line-through">Wallet Address</li>
                    <br />
                    <li className="text-gray-500 line-through">Transaction History</li>
                  </ul>
                </div>
                <p className="text-sm mt-4 italic">
                  The verifier only knows you belong to the compliant group, nothing else.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DemoPage;
