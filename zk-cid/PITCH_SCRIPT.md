## 1. The Paradox of Web3 Compliance (0:00 - 0:20)
*Opening shot: A split screen showing "Complete Privacy" on the left and "Strict Regulation" on the right. The two sides crash together.*
"Welcome to the biggest contradiction in Web3 today: The Compliance Paradox. Traditional KYC requires you to hand over your passport, face, and home address to centralized databases. It's a massive privacy leak waiting to happen. But completely anonymous DeFi? That gets shut down by regulators. Until now, you had to choose: expose your privacy, or break the law."

## 2. Introducing ZK-CID (0:20 - 0:50)
*Slide transition: Introducing "ZK-CID: Zero-Knowledge Compliant Identity"*
"Enter ZK-CID. We use Decentralized Identity and Zero-Knowledge Proofs to let you prove *'I am compliant'* without ever revealing *'who I am'*. Imagine walking into a 21+ club, and the bouncer instantly knows you're over 21, but doesn't know your name, birthdate, or ID number. That's what we built for DeFi."

## 3. The Demo: How it works (0:50 - 1:50)
*Screen recording of the Next.js frontend*
"Let's see it in action. First, as a user, I generate an anonymous identity locally in my browser. My private key never leaves this device. 
Second, a trusted Issuer—say, a KYC provider—verifies my real-world documents off-chain. Once approved, they simply add my anonymous 'commitment' to an on-chain Semaphore Group.
Now for the magic. I want to access a regulated DeFi protocol. I generate a Zero-Knowledge Proof right here in the browser. This math proves two things: I belong to the approved group, and I haven't used this proof before. I submit it on-chain. The smart contract verifies the math, mints my Access NFT, and lets me in. It never knew my address until I interacted with it anonymously."

## 4. The Future of Privacy (1:50 - 2:30)
*Slide transition: "Traditional vs. ZK-CID"*
"Look at the difference. Traditional KYC: your name, address, and ID are exposed to every protocol. With ZK-CID: only a cryptographic proof is shared. Regulators are happy because only verified users get in. Users are happy because their privacy is absolute. This isn't just a hackathon project; it's the future infrastructure of compliant Web3. Thank you."