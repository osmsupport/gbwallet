import React, { FC, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'; 
import { Link } from "react-router-dom";
import Header from "./includes/header";
import {
  GlowWalletAdapter,
  PhantomWalletAdapter,
  SlopeWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import {
    WalletModalProvider,
    WalletDisconnectButton,
    WalletMultiButton
} from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
const style = {
  _GB_Banner_Top: {
    background: "#000"
  },
  _nav_link: {
    color: "#fff"
  }
};
const images = require.context("./../assets/images", true);
// Default styles that can be overridden by your app
require('@solana/wallet-adapter-react-ui/styles.css');
function Home() {
  const images = require.context("./../assets/images", true);
  const network = WalletAdapterNetwork.Devnet;

    // You can also provide a custom RPC endpoint.
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);

    const wallets = useMemo(
        () => [
          new PhantomWalletAdapter(),
          new GlowWalletAdapter(),
          new SlopeWalletAdapter(),
          new SolflareWalletAdapter({ network }),
          new TorusWalletAdapter(),
        ],
        []
    );
  return ( 
    <>
    <div className="_GB_Home">
      <div className="_GB_Banner_Top">
        <Header /> 
      </div>
      <div className="_GB_About pt-4 pb-4 d-flex align-items-center">
        <div className="container">
          <div className="_GB_About_row d-flex align-items-center">
            <div className="col-6">
              <div className="_GB_About_Title">
                We’re taking gaming to a whole new level.
              </div>
            </div>
            <div className="col-6">
              <div className="_GB_About_SubTitle">
                Gamebeef is a gaming platform that will allow players to earn
                CryptoCurrency (In the form of tokens, a Solana token) for
                in-game performance. Tokens can be used to purchase Perks,
                products such as Ps5’s, Oculus’ Airpods, and exchange for other
                cryptocurrencies.
              </div>
              <button
                type="button"
                className="_GB_Common_Btn btn btn-danger mt-4 mb-4"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </div> 
    </div> 
        </>
  );
}

export default Home;
