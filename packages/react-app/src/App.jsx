import React, { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Switch, Route, Link } from "react-router-dom";
import "antd/dist/antd.css";
import {  JsonRpcProvider, Web3Provider } from "@ethersproject/providers";
import { ExportOutlined, CloseCircleOutlined, WalletOutlined, SendOutlined, CaretUpOutlined, HistoryOutlined, ScanOutlined } from "@ant-design/icons";
import "./App.css";
import { Image, List, Card, Drawer, Tooltip, Select, Row, Col, Button, Menu, Alert, Spin, Switch as SwitchD } from "antd";
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import { useUserAddress } from "eth-hooks";
import { usePoller, useExchangePrice, useGasPrice, useUserProvider, useContractLoader, useContractReader, useEventListener, useBalance, useExternalContractLoader } from "./hooks";
import { Wallet, AddressInput, EtherInput, Header, Account, Faucet, Ramp, Contract, GasGauge, ThemeSwitch, QRPunkBlockie, Address, Balance } from "./components";
import { Transactor } from "./helpers";
import { formatEther, parseEther } from "@ethersproject/units";
//import Hints from "./Hints";
import { Hints, ExampleUI, Subgraph } from "./views"
import { useThemeSwitcher } from "react-css-theme-switcher";
import { INFURA_ID, DAI_ADDRESS, DAI_ABI, NETWORK, NETWORKS } from "./constants";
import StackGrid from "react-stack-grid"
import Blockies from "react-blockies";

//import Avatars from '@dicebear/avatars';
//import sprites from '@dicebear/avatars-bottts-sprites';

let options = { dataUri: true};
//let avatars = new Avatars(sprites, options);
const { ethers } = require("ethers");
/*
    Welcome to 🏗 scaffold-eth !

    Code:
    https://github.com/austintgriffith/scaffold-eth

    Support:
    https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA
    or DM @austingriffith on twitter or telegram

    You should get your own Infura.io ID and put it in `constants.js`
    (this is your connection to the main Ethereum network for ENS etc.)


    🌏 EXTERNAL CONTRACTS:
    You can also bring in contract artifacts in `constants.js`
    (and then use the `useExternalContractLoader()` hook!)
*/


/// 📡 What chain are your contracts deployed to?
//const cachedNetwork = window.localStorage.getItem("network")
//let targetNetwork =  NETWORKS[cachedNetwork?cachedNetwork:'ethereum']; // <------- select your target frontend network (localhost, rinkeby, xdai, mainnet)
//if(!targetNetwork){
let targetNetwork =  NETWORKS['xdai'];
//}
// 😬 Sorry for all the console logging
const DEBUG = false

const LOOK_BACK_TO_BLOCK_FOR_EVENTS = 1

const DISPLAY_WEB3_CONNECT = false

const USE_DELAY = true


// 🛰 providers
if(DEBUG) console.log("📡 Connecting to Mainnet Ethereum");
// const mainnetProvider = getDefaultProvider("mainnet", { infura: INFURA_ID, etherscan: ETHERSCAN_KEY, quorum: 1 });
// const mainnetProvider = new InfuraProvider("mainnet",INFURA_ID);
//
// attempt to connect to our own scaffold eth rpc and if that fails fall back to infura...
const scaffoldEthProvider = new JsonRpcProvider("https://rpc.scaffoldeth.io:48544")
const mainnetInfura = new JsonRpcProvider("https://mainnet.infura.io/v3/" + INFURA_ID)
// ( ⚠️ Getting "failed to meet quorum" errors? Check your INFURA_I

// 🏠 Your local provider is usually pointed at your local blockchain
const localProviderUrl = targetNetwork.rpcUrl;
// as you deploy to other networks you can set REACT_APP_PROVIDER=https://dai.poa.network in packages/react-app/.env
const localProviderUrlFromEnv = process.env.REACT_APP_PROVIDER ? process.env.REACT_APP_PROVIDER : localProviderUrl;
if(DEBUG) console.log("🏠 Connecting to provider:", localProviderUrlFromEnv);
let localProvider = new JsonRpcProvider(localProviderUrlFromEnv);


// 🔭 block explorer URL
let blockExplorer = targetNetwork.blockExplorer;

// a function to check your balance on every network and switch networks if found...
const checkBalances = async (address)=>{
  for(let n in NETWORKS){
    let tempProvider = new JsonRpcProvider(NETWORKS[n].rpcUrl);
    let tempBalance = await tempProvider.getBalance(address);
    let result = tempBalance && formatEther(tempBalance)
    if(result!=0){
      console.log("Found a balance in ",n)
      window.localStorage.setItem("network",n);
      setTimeout(() => {
        window.location.reload();
      }, 1);
    }
  }
}

let scanner;

function App(props) {

  const mainnetProvider = (scaffoldEthProvider && scaffoldEthProvider._network) ? scaffoldEthProvider : mainnetInfura
  if(DEBUG) console.log("🌎 mainnetProvider",mainnetProvider)

  const [injectedProvider, setInjectedProvider] = useState();

  /* 💵 This hook will get the price of ETH from 🦄 Uniswap: */
  const price = useExchangePrice(targetNetwork,mainnetProvider);

  /* 🔥 This hook will get the price of Gas from ⛽️ EtherGasStation */
  const gasPrice = useGasPrice(targetNetwork,"fast");
  // Use your injected provider from 🦊 Metamask or if you don't have it then instantly generate a 🔥 burner wallet.
  const userProvider = useUserProvider(injectedProvider, localProvider);
  const address = useUserAddress(userProvider);
  if(DEBUG) console.log("👩‍💼 selected address:",address)

  // You can warn the user if you would like them to be on a specific network
  let localChainId = localProvider && localProvider._network && localProvider._network.chainId
  if(DEBUG) console.log("🏠 localChainId",localChainId)

  let selectedChainId = userProvider && userProvider._network && userProvider._network.chainId
  if(DEBUG) console.log("🕵🏻‍♂️ selectedChainId:",selectedChainId)

  // For more hooks, check out 🔗eth-hooks at: https://www.npmjs.com/package/eth-hooks

  // The transactor wraps transactions and provides notificiations
  const tx = Transactor(userProvider, gasPrice)

  // Faucet Tx can be used to send funds from the faucet
  const faucetTx = Transactor(localProvider, gasPrice)

  // 🏗 scaffold-eth is full of handy hooks like this one to get your balance:
  const yourLocalBalance = useBalance(localProvider, address);
  if(DEBUG) console.log("💵 yourLocalBalance",yourLocalBalance?formatEther(yourLocalBalance):"...")

  const balance = yourLocalBalance && formatEther(yourLocalBalance)


  //if you don't have any money, scan the other networks for money
  /*usePoller(()=>{
    if(!cachedNetwork){
      if(balance==0){
        checkBalances(address)
      }
    }
  },7777)
  setTimeout(()=>{
    if(!cachedNetwork){
      if(balance==0){
        checkBalances(address)
      }
    }
  },1777)
  setTimeout(()=>{
    if(!cachedNetwork){
      if(balance==0){
        checkBalances(address)
      }
    }
  },3777)*/


  // Just plug in different 🛰 providers to get your balance on different chains:
  const yourMainnetBalance = useBalance(mainnetProvider, address);
  if(DEBUG) console.log("💵 yourMainnetBalance",yourMainnetBalance?formatEther(yourMainnetBalance):"...")

  // Load in your local 📝 contract and read a value from it:
  const readContracts = useContractLoader(localProvider)
  if(DEBUG) console.log("📝 readContracts",readContracts)

  // If you want to make 🔐 write transactions to your contracts, use the userProvider:
  const writeContracts = useContractLoader(userProvider)
  if(DEBUG) console.log("🔐 writeContracts",writeContracts)



  const prices = useContractReader(readContracts,"GTGSCollectible", "prices")
  if(DEBUG) console.log("🤏 prices",prices)

  const counts = useContractReader(readContracts,"GTGSCollectible", "counts")
  if(DEBUG) console.log("🏛 counts",counts)

  const balances = useContractReader(readContracts,"GTGSCollectible", "balances",[ address ])
  if(DEBUG) console.log("🏦 balances",balances)

  const burns = useContractReader(readContracts,"GTGSCollectible", "burns")
  if(DEBUG) console.log("🔥 burns",burns)

  const royaltiesSent = useContractReader(readContracts,"GTGSCollectible", "royaltiesSent")
  if(DEBUG) console.log("🧑‍🎤 royaltiesSent",royaltiesSent)

  const artist = useContractReader(readContracts,"GTGSCollectible", "artist")
  if(DEBUG) console.log("🧑‍🎤 artist",artist)


  // EXTERNAL CONTRACT EXAMPLE:
  //
  // If you want to bring in the mainnet DAI contract it would look like:
  //const mainnetDAIContract = useExternalContractLoader(mainnetProvider, DAI_ADDRESS, DAI_ABI)
  //console.log("🌍 DAI contract on mainnet:",mainnetDAIContract)
  //
  // Then read your DAI balance like:
  //const myMainnetDAIBalance = useContractReader({DAI: mainnetDAIContract},"DAI", "balanceOf",["0x34aA3F359A9D614239015126635CE7732c18fDF3"])
  //console.log("🥇 myMainnetDAIBalance:",myMainnetDAIBalance)


  // keep track of a variable from the contract in the local React state:
  //const purpose = useContractReader(readContracts,"YourContract", "purpose")
  //console.log("🤗 purpose:",purpose)

  //📟 Listen for broadcast events
  const streamEvents = useEventListener(readContracts, "GTGSCollectible", "Stream", localProvider, LOOK_BACK_TO_BLOCK_FOR_EVENTS);
  console.log("📟 streamEvents:",streamEvents)



  const [ thinking, setThinking ] = useState()

  const yourCollectibles = [{
      id: "1",
      name: "Amazonian"
    },{
      id: "2",
      name: "Opal Earth"
    },{
      id: "3",
      name: "Digital One"
    },{
      id: "4",
      name: "Anti-Ivory"
    },{
      id: "5",
      name: "Earth Core"
    },{
      id: "6",
      name: "Sky Stone"
    },{
      id: "7",
      name: "Green Earth Stone"
    },{
      id: "8",
      name: "Life Stone"
    },{
      id: "9",
      name: "Digital Forest"
    },{
      id: "10",
      name: "Jungle Stone"
    }
  ]

/*
  useEffect(()=>{
    const updateYourCollectibles = async () => {
      let collectibleUpdate = []
      for(let e in mintEvents){
        console.log("PARSE",mintEvents[e])
        try{
          if(mintEvents[e].tokenId){
            const tokenIndex = mintEvents[e].tokenId.toNumber()

            console.log("GEtting token owner of ",tokenIndex)
            const owner = await readContracts.GTGSCollectible.ownerOf(tokenIndex)
            console.log("ONWER  IS  token index",tokenIndex,owner)
            const tokenURI = await readContracts.GTGSCollectible.tokenURI(tokenIndex)
            console.log("got tokenURI",tokenURI)

            collectibleUpdate.push({ id:tokenIndex, tokenURI:tokenURI, owner: owner })

          }
        }catch(e){console.log(e)}
      }
      setYourCollectibles(collectibleUpdate)
    }
    updateYourCollectibles()
  },[ address, mintEvents ])
  */
  /*
  const addressFromENS = useResolveName(mainnetProvider, "austingriffith.eth");
  console.log("🏷 Resolved austingriffith.eth as:",addressFromENS)
  */

 ///console.log("yourCollectibles",yourCollectibles)


  let networkDisplay = ""
  if(localChainId && selectedChainId && localChainId != selectedChainId ){
    networkDisplay = (
      <div style={{zIndex:2, position:'absolute', right:0,top:0,padding:8}}>
        <Alert
          message={"⚠️ Wrong Network"}
          description={(
            <div>
              You have <b>{NETWORK(selectedChainId).name}</b> selected and you need to be on <Button onClick={async ()=>{
                 let ethereum = window.ethereum;
                 const data = [{
                     chainId: "0x"+targetNetwork.chainId.toString(16),
                     chainName: targetNetwork.name,
                     nativeCurrency:targetNetwork.nativeCurrency,
                     rpcUrls: [targetNetwork.rpcUrl],
                     blockExplorerUrls: [targetNetwork.blockExplorer],
                 }]
                 console.log("data",data)
                 const tx = await ethereum.request({method: 'wallet_addEthereumChain', params:data}).catch()
                 if (tx) {
                     console.log(tx)

                 }
              }}>{NETWORK(localChainId).name}</Button>.
            </div>
          )}
          type="error"
          closable={false}
        />
      </div>
    )
  }
/*
  let options = []
  for(let id in NETWORKS){
    options.push(
      <Select.Option key={id} value={NETWORKS[id].name}><span style={{color:NETWORKS[id].color}}>
        {NETWORKS[id].name}
      </span></Select.Option>
    )
  }

  const networkSelect = (
    <Select defaultValue={targetNetwork.name} style={{ textAlign:"left", width: 120 }} onChange={(value)=>{
      if(targetNetwork.chainId != NETWORKS[value].chainId){
        window.localStorage.setItem("network",value);
        setTimeout(() => {
          window.location.reload();
        }, 1);
      }
    }}>
      {options}
    </Select>
  )
*/

  const loadWeb3Modal = useCallback(async () => {
    const provider = await web3Modal.connect();
    setInjectedProvider(new Web3Provider(provider));
  }, [setInjectedProvider]);

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      loadWeb3Modal();
    }
  }, [loadWeb3Modal]);

  const [route, setRoute] = useState();
  useEffect(() => {
    setRoute(window.location.pathname)
  }, [setRoute]);

  let faucetHint = ""
  const faucetAvailable = localProvider && localProvider.connection && localProvider.connection.url && localProvider.connection.url.indexOf("localhost")>=0 && !process.env.REACT_APP_PROVIDER && price > 1;

  const [ faucetClicked, setFaucetClicked ] = useState( false );
  if(!faucetClicked&&localProvider&&localProvider._network&&localProvider._network.chainId==31337&&yourLocalBalance&&formatEther(yourLocalBalance)<=0){
    faucetHint = (
      <div style={{padding:16}}>
        <Button type={"primary"} onClick={()=>{
          faucetTx({
            to: address,
            value: parseEther("0.01"),
          });
          setFaucetClicked(true)
        }}>
          💰 Grab funds from the faucet ⛽️
        </Button>
      </div>
    )
  }

  let startingAddress = ""
  if(window.location.pathname){
    let incoming = window.location.pathname.replace("/","")
    if(incoming && ethers.utils.isAddress(incoming)){
      startingAddress = incoming
      window.history.pushState({},"", "/");
    }

    /*let rawPK
    if(incomingPK.length===64||incomingPK.length===66){
      console.log("🔑 Incoming Private Key...");
      rawPK=incomingPK
      burnerConfig.privateKey = rawPK
      window.history.pushState({},"", "/");
      let currentPrivateKey = window.localStorage.getItem("metaPrivateKey");
      if(currentPrivateKey && currentPrivateKey!==rawPK){
        window.localStorage.setItem("metaPrivateKey_backup"+Date.now(),currentPrivateKey);
      }
      window.localStorage.setItem("metaPrivateKey",rawPK);
    }*/
  }
  //console.log("startingAddress",startingAddress)
  const [amount, setAmount] = useState();
  const [toAddress, setToAddress] = useState(startingAddress);

  const [loading, setLoading] = useState(false);

  const [walletUp, setWalletUp] = useState(false);

  const [ transferToAddresses, setTransferToAddresses ] = useState({})

  const walletDisplay = web3Modal && web3Modal.cachedProvider ? "":<Wallet invert={true} address={address} provider={userProvider} ensProvider={mainnetProvider} price={price} />

  let closeWalletButton = ""
  let scanButton = ""

  if(walletUp){
    closeWalletButton=(
      <div style={{ zIndex:10000,transform:"scale(2.7)",transformOrigin:"70% 80%", position: "absolute", textAlign: "right", right:-2, top: "9%", padding: 10 }}>

         <Button type={"secondary"} shape="circle" size={"large"} onClick={()=>{
           setWalletUp(false)
         }}>
           <CloseCircleOutlined style={{color:"#666666"}}/>
         </Button>
      </div>
    )
  }

/*<AddressInput
  ensProvider={mainnetProvider}
  placeholder="transfer to address"
  value={transferToAddresses[id]}
  onChange={(newValue)=>{
    let update = {}
    update[id] = newValue
    setTransferToAddresses({ ...transferToAddresses, ...update})
  }}
/>
<Button onClick={()=>{
  console.log("writeContracts",writeContracts)
  tx( writeContracts.YourCollectible.transferFrom(address, transferToAddresses[id], id) )
}}>
  Transfer
</Button>*/

  let galleryList = []
  for(let a in yourCollectibles){
    //console.log("yourCollectibles",yourCollectibles[a])

    let thisCollectible = yourCollectibles[a]

    let cardActions = []
    /*
    if(loadedAssets[a].forSale){
      cardActions.push(
        <div>
          <Button onClick={()=>{
            console.log("gasPrice,",gasPrice)
            tx( writeContracts.YourCollectible.mintItem(loadedAssets[a].id,{gasPrice:gasPrice}) )
          }}>
            Mint
          </Button>
        </div>
      )
    }else{
      cardActions.push(
        <div>
          owned by: <Address
            address={loadedAssets[a].owner}
            ensProvider={mainnetProvider}
            blockExplorer={blockExplorer}
            minimized={true}
          />
        </div>
      )
    }
    */

    //console.log("RENDER WITH ID",thisCollectible.id,"balances[thisCollectible.id]",balances && balances[thisCollectible.id])

    const thisBalance = balances && balances[thisCollectible.id-1] ? balances[thisCollectible.id-1].toNumber() : ""

    let streams = {}

    for(let e in streamEvents){
      const artwork = streamEvents[e].artwork.toNumber()
      if(!streams[artwork]){
        streams[artwork] = []
      }
      streams[artwork].push(streamEvents[e])
    }

    //console.log("streams",streams)


/*
    let renderMints = []
    for(let m in mints){
      renderMints.push(
        <span style={{padding:8}} key={"mint_"+mintEvents[e].owner+"-"+thisCollectible.id+"-"+mintEvents[e].blockNumber}>
          <Blockies seed={mintEvents[e].owner.toLowerCase()} size={8} scale={3} />
        </span>
      )
    }
*/
    ////// green and red prices from ui <span style={{color:"#ae5d5d",marginRight:8}}>{prices&&prices[thisCollectible.id-1]?formatEther(prices[thisCollectible.id-1]).substr(0,7):""}</span>
    /////// <span style={{color:"#6dae5d",marginLeft:8}}>{burns&&burns[thisCollectible.id-1]?formatEther(burns[thisCollectible.id-1]).substr(0,7):""}</span>
/////{burns&&burns[thisCollectible.id-1]?formatEther(burns[thisCollectible.id-1]).substr(0,7):""}

    //burnEvents

    //console.log("counts[thisCollectible.id-1]",counts && counts[thisCollectible.id-1])


    let currentCount
    try{
     currentCount = counts && counts[thisCollectible.id-1] ? counts[thisCollectible.id-1].toNumber() : ""
    }catch(e){
      console.log(e)
    }

    let stream = streams[thisCollectible.id]

    stream = stream && stream.slice(0, 4)

    //const reversed = stream && stream.reverse();

    //console.log("stream",stream)

    let streamDisplay = []
    for(let i in stream){
      const thisEvent = stream[i]

      const isMint = thisEvent.royalties&&thisEvent.royalties.eq(0)

      let color =

      streamDisplay.push(
        <div key={"stream_"+thisCollectible.id+"_"+i} style={{marginTop:16,marginLeft:"22%",textAlign:"left"}}>
          <Address value={thisEvent.owner} fontSize={12} /> {isMint?"minted for":"burned for"} {thisEvent.amount && formatEther(thisEvent.amount).substr(0,7)} {isMint?"":thisEvent&&thisEvent.royalties&&"(-"+formatEther(thisEvent.royalties).substr(0,8)+")"}
        </div>
      )
    }

    galleryList.push(
      <Card style={{width:"100%"}} key={"gallery"+thisCollectible.id}
        actions={cardActions}
      >
        <Row>
          <Col span={12}>
            <Image src={"./previews/"+thisCollectible.id+".jpg"} style={{maxWidth:550}} />
          </Col>
          <Col span={12}>
            <h2>
              {thisCollectible.name}
            </h2>
            <div style={{fontSize:64}}>
              { thisBalance } <span style={{opacity:0.05}}>/</span> <span style={{opacity:0.15}}>{ currentCount }</span>
            </div>


            <Button disabled={thinking}  onClick={async()=>{
              if(USE_DELAY) {
                setThinking(true)
                setTimeout(()=>{
                  setThinking(false)
                },5000)
              }
              let price = await readContracts.GTGSCollectible.price(thisCollectible.id)
              console.log("price",price)

              tx( writeContracts.GTGSCollectible.mint(thisCollectible.id,{value: price,gasPrice:gasPrice}) )
            }}>
              <span style={{color:"#ae5d5d",marginRight:8}}>{prices&&prices[thisCollectible.id-1]?formatEther(prices[thisCollectible.id-1]).substr(0,7):""}</span> Mint
            </Button>

            <span style={{padding:8}}>

            </span>

            <Button disabled={!thisBalance || thinking} onClick={async()=>{
              if(USE_DELAY) {
                setThinking(true)
                setTimeout(()=>{
                  setThinking(false)
                },5000)
              }
              try{
                let burnTokenId = await readContracts.GTGSCollectible.tokenOfOwnerByIndex(address,thisBalance-1)
                console.log("burnTokenId",burnTokenId)
                tx( writeContracts.GTGSCollectible.burn(thisCollectible.id,burnTokenId,{gasPrice:gasPrice}) )
              }catch(e){
                  console.log(e)
              }

            }}>
              Burn <span style={{color:"#6dae5d",marginLeft:8}}>{burns&&burns[thisCollectible.id-1]?formatEther(burns[thisCollectible.id-1]).substr(0,7):""}</span>
            </Button>
            <div style={{padding:32}}>
              {streamDisplay}
            </div>
{/*
            <div>
              {mints}
            </div>
            <div style={{padding:32}}>
              Owners eligible to win the gold NFT on Ethereum:
              <div>
                <img src={"http://localhost:3000/previews/"+thisCollectible.id+"gold.jpg"} style={{maxWidth:180}} />
              </div>
            </div>*/}

          </Col>
        </Row>

      </Card>
    )
  }

  return (
    <div className="App" style={{fontFamily:'"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: 24}}>
      <div style={{background:"url('./GTGS21_Hero_image_March21.jpg')",backgroundSize: "cover"}}>

        {networkDisplay}
        <div className="site-page-header-ghost-wrapper">
          <Header extra={
            [
              <Address
                fontSize={32}
                address={address}
                ensProvider={mainnetProvider}
                blockExplorer={blockExplorer}
                invert={true}
              />,
              /*<span style={{ verticalAlign: "middle", paddingLeft: 16, fontSize: 32 }}>
                <Tooltip title="History">
                  <HistoryOutlined onClick={async () => {
                    window.open("https://zapper.fi/transactions?address="+address)
                  }}/>
                </Tooltip>
              </span>,*/
              walletDisplay,
              DISPLAY_WEB3_CONNECT?<Account
                address={address}
                localProvider={localProvider}
                userProvider={userProvider}
                mainnetProvider={mainnetProvider}
                price={price}
                web3Modal={web3Modal}
                loadWeb3Modal={loadWeb3Modal}
                logoutOfWeb3Modal={logoutOfWeb3Modal}
                blockExplorer={blockExplorer}
              />:"",
              <span style={{ padding:8 }}>
               <ExportOutlined style={{ color:"#ffffff" }} onClick={()=>{
                 window.open("https://blockscout.com/xdai/mainnet/address/"+address)
               }}/>
              </span>
            ]
          }/>
        </div>
      </div>

      <div style={{marginTop:32}}>
        <h2>Voice Gems</h2>
        <p style={{fontSize:14, width:400, border:"1px solid #e8e8e8",margin:"auto",padding:32}}>
          Explanation copy here... we can talk about how each piece is sold on a bonding curve that holds liqudity. We can also mention that some of that liquidity leaks in the form of artist royalties on burn. Finally, a random owner of each of the NFTs will be minted a gold edition Voice Gems on mainnet Ethereum.
        </p>
      </div>



      {/*
        <div style={{ width:"77vw", margin: "auto", marginTop:32, paddingBottom:32 }}>



        </div>
        <div style={{ width:"77vw", margin: "auto", marginTop:32, paddingBottom:32 }}>

          <Button type={"primary"} onClick={()=>{
            console.log("writeContracts",writeContracts)
            tx( writeContracts.GTGSCollectible.mint() )
          }}>
            🎟  Mint
          </Button>

        </div>*/}


      <div style={{ width:920, margin: "auto", marginTop:32, paddingBottom:256 }}>
        {galleryList}
      </div>
      {/*
        <StackGrid
          columnWidth={200}
          gutterWidth={16}
          gutterHeight={16}
        >
          {galleryList}
        </StackGrid>
        */}


      <Drawer
          title={(
            <div style={{ opacity:yourLocalBalance?1:0.2, padding:16, width:"100%"}}>
              <Row style={{width:"100%"}}>
                <Col style={{width:"50%",textAlign:"right"}}>
                  <Balance value={yourLocalBalance} size={52} price={price} /><span style={{verticalAlign:"middle"}}></span>
                </Col>
                <Col style={{opacity:0.5,width:"50%",textAlign:"left"}}>
                  <Balance value={yourLocalBalance} size={24} /><span style={{verticalAlign:"middle"}}> xDAI</span>
                </Col>
              </Row>
            </div>
          )}
          placement={"bottom"}
          closable={true}
          onClose={()=>{
            setWalletUp(false)
          }}
          visible={walletUp}
          key={"walletDrawer"}
          height={"90%"}
        >
          <div style={{position: "relative"}}>
              <div style={{padding:16,cursor:"pointer",backgroundColor:"#FFFFFF",width:420,margin:"auto"}}>
                <QRPunkBlockie withQr={true} address={address} />
              </div>

              <div style={{position:"relative", width:320, margin:"auto",textAlign:"center",marginTop:32}}>
                <div style={{padding: 10}}>
                  <AddressInput
                    ensProvider={mainnetProvider}
                    placeholder="to address"
                    address={toAddress}
                    onChange={setToAddress}
                    hoistScanner={(toggle)=>{
                      scanner=toggle
                    }}
                  />
                </div>
                <div style={{padding: 10}}>
                  <EtherInput
                    price={price?price:targetNetwork.price}
                    value={amount}
                    onChange={value => {
                      setAmount(value);
                    }}
                  />
                </div>
                <div style={{padding: 10}}>
                  <Button
                    key="sendFunds"
                    type="primary"
                    disabled={loading || !amount || !toAddress }
                    loading={loading}
                    onClick={async () => {
                      setLoading(true)

                      let value;
                      try {
                        value = parseEther("" + amount);
                      } catch (e) {
                        let floatVal = parseFloat(amount).toFixed(8)
                        // failed to parseEther, try something else
                        value = parseEther("" + floatVal);
                      }

                      let result = tx({
                        to: toAddress,
                        value,
                        gasPrice: gasPrice,
                        gasLimit: 21000
                      });
                      //setToAddress("")
                      setAmount("")
                      result = await result
                      console.log(result)
                      setLoading(false)
                    }}
                  >
                    {loading || !amount || !toAddress ? <CaretUpOutlined /> : <SendOutlined style={{color:"#FFFFFF"}} /> } Send
                  </Button>
                </div>



                <div style={{ zIndex: walletUp?1:-1,opacity: walletUp?1:0, transform:"scale(2.7)",transformOrigin:"70% 80%", position: "fixed", textAlign: "right", right: 0, bottom: 160, padding: 10 }}>

                   <Button key={"theScanner"} disabled={!walletUp} type={"primary"} shape="circle" size={"large"} onClick={()=>{
                     scanner(true)
                   }}>
                     <ScanOutlined style={{color:"#FFFFFF"}}/>
                   </Button>
                </div>
              </div>
            </div>
      </Drawer>

      {
        address&&royaltiesSent?
        <div style={{padding:64,fontSize:14,opacity:0.85}}>{royaltiesSent && formatEther(royaltiesSent).substr(0,7)} royalties collected by <Address fontSize={12} value={artist}/></div>
        :""
      }
{/*
      <Contract
        name="GTGSCollectible"
        signer={userProvider.getSigner()}
        provider={localProvider}
        address={address}
        blockExplorer={blockExplorer}
      />

      */}

      {/*


        <Contract
          name="GTGSCollectible"
          signer={userProvider.getSigner()}
          provider={localProvider}
          address={address}
          blockExplorer={blockExplorer}
        />

        ✏️ Edit the header and change the title to your project name *//*{networkSelect}*/}



      {/*<BrowserRouter>

        <Menu style={{ textAlign:"center" }} selectedKeys={[route]} mode="horizontal">
          <Menu.Item key="/">
            <Link onClick={()=>{setRoute("/")}} to="/">YourContract</Link>
          </Menu.Item>
          <Menu.Item key="/hints">
            <Link onClick={()=>{setRoute("/hints")}} to="/hints">Hints</Link>
          </Menu.Item>
          <Menu.Item key="/exampleui">
            <Link onClick={()=>{setRoute("/exampleui")}} to="/exampleui">ExampleUI</Link>
          </Menu.Item>
          <Menu.Item key="/mainnetdai">
            <Link onClick={()=>{setRoute("/mainnetdai")}} to="/mainnetdai">Mainnet DAI</Link>
          </Menu.Item>
          <Menu.Item key="/subgraph">
            <Link onClick={()=>{setRoute("/subgraph")}} to="/subgraph">Subgraph</Link>
          </Menu.Item>
        </Menu>
        <Switch>
          <Route exact path="/">
            }
            <Contract
              name="YourContract"
              signer={userProvider.getSigner()}
              provider={localProvider}
              address={address}
              blockExplorer={blockExplorer}
            />



          </Route>
          <Route path="/hints">
            <Hints
              address={address}
              yourLocalBalance={yourLocalBalance}
              mainnetProvider={mainnetProvider}
              price={price}
            />
          </Route>
          <Route path="/exampleui">
            <ExampleUI
              address={address}
              userProvider={userProvider}
              mainnetProvider={mainnetProvider}
              localProvider={localProvider}
              yourLocalBalance={yourLocalBalance}
              price={price}
              tx={tx}
              writeContracts={writeContracts}
              readContracts={readContracts}
              purpose={purpose}
              setPurposeEvents={setPurposeEvents}
            />
          </Route>
          <Route path="/mainnetdai">
            <Contract
              name="DAI"
              customContract={mainnetDAIContract}
              signer={userProvider.getSigner()}
              provider={mainnetProvider}
              address={address}
              blockExplorer={"https://etherscan.io/"}
            />
          </Route>
          <Route path="/subgraph">
            <Subgraph
            subgraphUri={props.subgraphUri}
            tx={tx}
            writeContracts={writeContracts}
            mainnetProvider={mainnetProvider}
            />
          </Route>
        </Switch>
      </BrowserRouter>
*/}



<div style={{padding:32}}>
</div>

  {closeWalletButton}

  <div style={{ zIndex:2,transform:"scale(2)",transformOrigin:"70% 80%", position: "fixed", textAlign: "right", right: 0, bottom: 16, padding: 10 }}>

     <Button type={"primary"} shape="oval" size={"large"} onClick={()=>{
       //scanner(true)
       setWalletUp(true)
     }}>
       <Balance value={yourLocalBalance} size={14} /*price={price}*/ /><span style={{verticalAlign:"middle"}}></span>
       <WalletOutlined style={{color:"#FFFFFF"}}/>
     </Button>
  </div>


  {/*






🗺 Extra UI like gas price, eth price, faucet, and support:
<div style={{ position: "fixed", textAlign: "left", left: 0, bottom: 20, padding: 10 }}>
  <Row align="middle" gutter={[16, 16]}>
    <Col span={12}>
      <Ramp price={price} address={address} networks={NETWORKS}/>
    </Col>

    <Col span={12} style={{ textAlign: "center", opacity: 0.8 }}>
      <GasGauge gasPrice={gasPrice} />
    </Col>
  </Row>

  <Row align="middle" gutter={[4, 4]}>
    <Col span={24}>
      {
        faucetAvailable ? (
          <Faucet localProvider={localProvider} price={price} ensProvider={mainnetProvider}/>
        ) : (
          ""
        )
      }
    </Col>
  </Row>
</div>
*/}



    </div>
  );
}


/*
  Web3 modal helps us "connect" external wallets:
*/
const web3Modal = new Web3Modal({
  // network: "mainnet", // optional
  cacheProvider: true, // optional
  providerOptions: {
    walletconnect: {
      package: WalletConnectProvider, // required
      options: {
        infuraId: INFURA_ID,
      },
    },
  },
});

const logoutOfWeb3Modal = async () => {
  await web3Modal.clearCachedProvider();
  setTimeout(() => {
    window.location.reload();
  }, 1);
};

 window.ethereum && window.ethereum.on('chainChanged', chainId => {
  setTimeout(() => {
    window.location.reload();
  }, 1);
})

export default App;
