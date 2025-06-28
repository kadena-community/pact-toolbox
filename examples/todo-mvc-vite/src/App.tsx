import { useQuery } from "@tanstack/react-query";
import { setupWallets } from "@pact-toolbox/wallet-adapters";
import { getGlobalNetworkContext } from "@pact-toolbox/transaction";
import { TodoList } from "./components/TodoList";

function App() {
  const { isLoading } = useQuery({
    queryKey: ["wallets/setup"],
    queryFn: () => {
      // Initialize global network context
      const _context = getGlobalNetworkContext();
      return setupWallets({
        autoConnect: true,
        wallets: ["keypair", "ecko", "chainweaver", "zelcore"],
        // preferredWallets: ["keypair", "ecko"],
      })
        .then((wallet) => {
          if (wallet) {
            console.log("Auto-connected to wallet:", wallet);
          }
          return wallet;
        })
        .catch((error) => {
          console.log("Auto-connect failed or no previous connection:", error);
        });
    },
  });
  return isLoading ? <div>Loading...</div> : <TodoList />;
}

export default App;
