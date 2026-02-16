/**
 * Bank Code to Finco Bank ID mapping
 * Generated from Finco's /v1/banks endpoint
 * 
 * CLABE structure: [3 digits bank code][11 digits account][4 digits control]
 */

export const BANK_CODE_TO_FINCO_ID: Record<string, { id: string; name: string }> = {
  // SPEI Banks (primeros 3 dígitos de CLABE)
  '002': { id: '3054ff18-32a0-478d-b9fe-b5261f9a6e1f', name: 'BANAMEX' },
  '006': { id: '1e8c024f-5276-41c4-bfe9-a4cf07821a34', name: 'BANCOMEXT' },
  '009': { id: '80028ffa-88b4-4a94-80e8-3ec9b826b7fb', name: 'BANOBRAS' },
  '012': { id: '1953a92c-11e5-4315-b406-b89dd6b699b4', name: 'BBVA MEXICO' },
  '014': { id: '3114d179-8a10-40b9-b040-20ff464b50e0', name: 'SANTANDER' },
  '019': { id: 'f2b7877c-6ca9-46f5-96a1-434b05599abc', name: 'BANJERCITO' },
  '021': { id: 'f78d3263-65eb-477f-ba55-bd789848f334', name: 'HSBC' },
  '030': { id: '245e2c1d-e805-450c-b57d-3f3c1a947169', name: 'BAJIO' },
  '036': { id: '3fd10afd-c827-45c1-ae22-38f376de9159', name: 'INBURSA' },
  '042': { id: '84217df3-788c-4849-9898-30e958f15fcc', name: 'MIFEL' },
  '044': { id: '0730b821-a88e-4308-8da3-1099ee81ebfa', name: 'SCOTIABANK' },
  '058': { id: '4cc84e03-d679-4863-b296-cd2d438b3732', name: 'BANREGIO' },
  '059': { id: '3979b2d2-1780-4df7-9679-5020c376e9c9', name: 'INVEX' },
  '060': { id: '815c35b7-866a-438f-af57-251d48131045', name: 'BANSI' },
  '062': { id: '987c9c9b-b999-41ac-bf70-f91445ee486f', name: 'AFIRME' },
  '072': { id: 'cf0ca911-256a-4f4c-a406-f865abcc07f5', name: 'BANORTE' },
  '106': { id: '7f7a8c75-0c45-43e5-bbc7-ee5d90ff5ad1', name: 'BANK OF AMERICA' },
  '108': { id: '9d105d03-a1b7-4e07-b968-08834fe1a077', name: 'MUFG' },
  '110': { id: '0a0e0b50-02c2-4c30-9fdc-788afd89182b', name: 'JP MORGAN' },
  '112': { id: 'eb0bb160-cc6b-4dc7-80cf-d7a3b26c4695', name: 'BMONEX' },
  '113': { id: '5aecc4af-cf14-4465-8a24-8bb8a84a8d27', name: 'VEPORMAS' },
  '124': { id: '17b12906-faa6-4c44-b29f-073d3e8943eb', name: 'CITI MEXICO' },
  '127': { id: '75528459-b61c-40f8-9625-5ccf68b4b8f3', name: 'AZTECA' },
  '128': { id: 'b82df284-83c4-4a27-874f-e67bd9e2c3e5', name: 'KAPITAL' },
  '129': { id: '72cd9d78-9da0-4cf3-a4e4-dd1c38028ea8', name: 'BARCLAYS' },
  '130': { id: '2533ed6d-65b3-4e1d-b334-bb54e4308c83', name: 'COMPARTAMOS' },
  '132': { id: 'b0fa8077-53e4-468a-bd97-15c8f8c5ed74', name: 'MULTIVABANCO' },
  '133': { id: '90ba511d-95bf-4849-a7be-cfc9d569dd77', name: 'ACTINVER' },
  '135': { id: '3ae00595-20a5-424c-9a9a-3f88f4a55ecd', name: 'NAFIN' },
  '136': { id: '2754e317-d703-4827-a891-494b02fbd4d5', name: 'INTERCAM BANCO' },
  '137': { id: 'f058590a-436f-4f0e-96f3-ba8f594ca2cc', name: 'BANCOPPEL' },
  '138': { id: '7ec813b6-759c-493f-b01c-d3cd8212217f', name: 'UALA' },
  '140': { id: 'cf6de715-98d1-4f1c-b924-1498af67cd8e', name: 'CONSUBANCO' },
  '141': { id: 'bb6bd49f-0eec-4958-90e7-8bfe47f205b4', name: 'VOLKSWAGEN' },
  '145': { id: 'bdd4b0e1-72e3-4108-888c-61e392fce607', name: 'BBASE' },
  '147': { id: '9593c687-d582-4703-82c5-42da69c8802c', name: 'BANKAOOL' },
  '148': { id: '934f9e53-6655-4a7d-bae1-3d5a8c4a135d', name: 'PAGATODO' },
  '150': { id: 'f88117e5-5e7a-4832-ba54-d44e256559d7', name: 'INMOBILIARIO' },
  '151': { id: '9aaff858-3a0a-4319-91fe-918e50042e12', name: 'DONDE' },
  '152': { id: '9a6624b2-cf14-49e7-bdf5-b2bff7d9f566', name: 'BANCREA' },
  '154': { id: 'e3d83df5-c164-4435-8b89-d4abf20beef8', name: 'BANCO COVALTO' },
  '155': { id: '976941c7-1b50-4f81-bf85-b84b8191e826', name: 'ICBC' },
  '156': { id: 'eab427d7-4d10-4a60-a921-230be1fdf271', name: 'SABADELL' },
  '157': { id: 'd7d1b36b-45f4-4542-b1b9-9fd89186ff6e', name: 'SHINHAN' },
  '158': { id: '8ae113df-2de5-470b-b6cc-7a2f853f1f5a', name: 'MIZUHOBANK' },
  '159': { id: 'fbc27b9b-7a49-43d9-b6f3-4c9c65793893', name: 'BANK OF CHINA' },
  '160': { id: '954628e6-0946-4bac-8228-2a9def5b0f8e', name: 'BANCO S3' },
  '166': { id: 'dde426ad-95c6-4305-b7fc-ca7e93fae02c', name: 'BANSEFI' },
  '167': { id: '2628c61a-e1a3-4ae3-b030-5f38e5dacd57', name: 'HEY BANCO' },
  '168': { id: '15bb1e94-cd5a-4acd-85b2-73a66838dd60', name: 'HIPOTECARIA FED' },
  
  // Digital Banks & Fintechs (90XXX codes)
  '600': { id: 'd7741883-4e93-46d8-8b48-c393f2cac99d', name: 'MONEXCB' },
  '601': { id: '7c80fff0-a4f1-41bb-b593-300cada50508', name: 'GBM' },
  '602': { id: '34934cdf-62c2-4abb-9fca-f3d8defe6948', name: 'MASARI' },
  '605': { id: '62f8c845-713b-4de6-bbb0-b7d190922e7c', name: 'VALUE' },
  '608': { id: '04a518e1-3aaf-4f78-987c-7ce16223cda1', name: 'VECTOR' },
  '616': { id: '718c4e98-2c16-4165-a26a-666eb0a42f77', name: 'FINAMEX' },
  '617': { id: '7dd470d4-735d-4cb9-887b-eebf5e7db7fc', name: 'VALMEX' },
  '620': { id: '0a82302e-298b-40f3-8319-99a5ae090d18', name: 'PROFUTURO' },
  '630': { id: '6a6771d2-f2af-4d5e-9bec-8477e800c0af', name: 'CB INTERCAM' },
  '631': { id: '74bfaf1a-c392-4854-b384-5a6503b30903', name: 'CI BOLSA' },
  '634': { id: '5c290980-5fe8-49f5-9ebd-d46d7c05c679', name: 'FINCOMUN' },
  '638': { id: '3168dc59-5e59-4623-a1c9-94051a949569', name: 'NU MEXICO' },
  '646': { id: 'd90bde89-d3b9-476b-9ce4-6d5633966011', name: 'STP' },
  '652': { id: '07cf60cc-c0b9-4a98-adf6-79a29ee86000', name: 'CREDICAPITAL' },
  '653': { id: '1e26b290-74e6-45fa-bb40-e95992af5607', name: 'KUSPIT' },
  '656': { id: 'f14c5106-0692-402e-be49-c2a2e50d8f60', name: 'UNAGRA' },
  '659': { id: '2356a347-d89b-4a58-9d2b-3320bbab2c9a', name: 'ASP INTEGRA OPC' },
  '661': { id: '771ade5f-f2c1-4cb2-b0b3-4cd2d1a2c5ee', name: 'KLAR' },
  '670': { id: 'ed810049-2b7d-45a6-9226-a485f7d00ea8', name: 'LIBERTAD' },
  '677': { id: '078e9e77-2f43-40a7-a278-18cb8987b431', name: 'CAJA POP MEXICA' },
  '680': { id: 'f4250a14-45ae-46f9-a4af-1564facc3449', name: 'CRISTOBALCOLON' },
  '683': { id: '70e75a55-3a1e-4a32-9754-537a6b319809', name: 'CAJATELEFONIST' },
  '684': { id: 'e39038af-1e15-4bda-9010-ddb871ee91f3', name: 'TRANSFER' },
  '685': { id: '49d3672b-3733-4063-afd5-87258093452b', name: 'FONDO (FIRA)' },
  '688': { id: '77bb9f46-5ab0-4e5c-9d68-5ba13acdca20', name: 'CREDICLUB' },
  '699': { id: '6000747a-915b-4507-a647-50d3cf9cb3f4', name: 'FONDEADORA' },
  '703': { id: '4cf24fe9-e848-451c-a156-763ccf4acfde', name: 'TESORED' },
  '706': { id: '5c0ab660-b2d9-420d-996d-96d1823e2d91', name: 'ARCUS FI' },
  '710': { id: '4950ff04-4915-4066-b2bf-7fb6b090b958', name: 'NVIO' },
  '720': { id: '9d1b2934-b825-4193-b2f5-839bf332e385', name: 'MexPago' },
  '721': { id: '476d0c85-2752-4ff8-b05c-b7ac228c4809', name: 'albo' },
  '722': { id: 'fc39ce95-d1bf-486f-b54b-c37b74637745', name: 'Mercado Pago W' },
  '723': { id: '139bc5d9-3020-4e25-9acc-3364262db77d', name: 'CUENCA' },
  '725': { id: '5600a6e7-910b-488f-9956-7e133f25e4c3', name: 'COOPDESARROLLO' },
  '727': { id: 'dbe1baf2-0c95-4033-b249-655d36f3311a', name: 'TRANSFER DIRECTO' },
  '728': { id: '3c71b5de-ece0-45d5-bec6-6fc616175fb6', name: 'SPIN_BY_OXXO' },
  '729': { id: 'a4202c42-ab62-4e33-9fa3-12fe3f82b6ef', name: 'Dep y Pag Dig' },
  '730': { id: '4f5bcda9-7ab3-490c-b3b9-912372d27582', name: 'Swap' },
  '732': { id: 'a6c7f256-3783-48c5-94db-324bc8f145d1', name: 'Peibo' },
  '734': { id: '9d84b03a-28d1-4898-a69c-38824239e2b1', name: 'FINCO PAY' },
  '738': { id: 'd5445483-b04d-4d2d-be0f-81752ededb6d', name: 'FINTOC' },
  
  // Test Banks
  '805': { id: 'de2592b3-328d-4378-8241-4092ecb31819', name: 'BanxicoPruebas' },
  '819': { id: 'd0d0e244-0828-4be5-9b28-5c62dd0cd7a8', name: 'BANCOPRUEBAS' },
  '820': { id: '0f1f4b11-613d-46c7-9cf4-00182f967b13', name: 'BancoPruebas' },
  '853': { id: '12dd60c1-5617-4224-9a79-c972faf91dca', name: 'GEMELOKUSPIT' },
  '901': { id: 'f4553a12-dd27-49f7-8d18-6a8416f994cb', name: 'CLS' },
  '902': { id: '5c889ac3-1e2a-47ad-b072-09bbe958ff17', name: 'INDEVAL' },
  '993': { id: 'a1b176ba-dcda-4ca7-a20a-c1d1405df380', name: 'BancoFacilB' },
  '994': { id: '87f3544b-e1db-4433-b507-c223cd3e4e8b', name: 'BancoFácil_R' },
  '995': { id: 'eaa38f20-f567-4ff9-96c1-1487ba30db09', name: 'BancoFácil' },
  '997': { id: '6c75d433-8a3c-44d9-a25b-a9ae89283a7a', name: 'BanCobroB' },
  '998': { id: 'e32200a8-0167-47ed-922e-faa8c9d39d21', name: 'BanCobroA' },
  '999': { id: 'a19806a6-8699-4c2d-88a2-f3c1409f6aa4', name: 'BancoFácil' },
};

/**
 * Get Finco bank ID from CLABE (first 3 digits)
 */
export function getBankIdFromClabe(clabe: string): { bankId: string; bankName: string } | null {
  if (!/^\d{18}$/.test(clabe)) {
    return null;
  }
  
  const bankCode = clabe.substring(0, 3);
  const bank = BANK_CODE_TO_FINCO_ID[bankCode];
  
  if (!bank) {
    return null;
  }
  
  return {
    bankId: bank.id,
    bankName: bank.name,
  };
}
