node index.js \
	--gasprice $GASPRICE \
  --url "https://kovan.infura.io/v3/$INFURA_API_KEY" \
  --mnemonic "$MNEMONIC" \
  --priceFeedIdentifier uSPAC10 \
  --collateralAddress "0xe22da380ee6b445bb8273c81944adeb6e8450422" \
  --expirationTimestamp "1643701088" `#Tue Feb 01 2022 15:38:08 GMT+0800 (Central Indonesia Time)` \
  --syntheticName "uSPAC10 Test" \
  --syntheticSymbol "uSPAC10-test" \
  --minSponsorTokens "1" 
