import { Button } from "antd";
import { ScanOutlined } from "@ant-design/icons";
import { useState } from "react";
import QrReader from "react-qr-reader";

const WalletConnectScanner = handleOnScan => {
  const [scan, setScan] = useState(false);
  return (
    <>
      {scan && (
        <div
          style={{
            zIndex: 256,
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
          }}
          onClick={() => {
            setScan(false);
          }}
        >
          <QrReader
            delay={250}
            resolution={1200}
            style={{ width: "100%" }}
            onError={e => {
              console.log("SCAN ERROR", e);
              setScan(false);
            }}
            onScan={newWalletConnectUri => {
              console.log("scanning");
              if (newWalletConnectUri) {
                console.log("SCAN VALUE", newWalletConnectUri);
                handleOnScan(newWalletConnectUri);
                setScan(false);
              }
            }}
          />
        </div>
      )}
      <Button
        size="large"
        shape="circle"
        style={{ marginLeft: 5 }}
        onClick={() => {
          setScan(!scan);
        }}
      >
        <ScanOutlined style={{ color: "red" }} />
      </Button>
    </>
  );
};

export default WalletConnectScanner;
