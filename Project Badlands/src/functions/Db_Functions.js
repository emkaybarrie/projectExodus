// async function saveScoreToDb(score, stage){
//     try {
//         const response = await fetch(
//           `${this.sheetUrl}?request=updateScore&id=${this.playerData.id}&score=${Math.round(score)}&level=${stage}`,{
//             method: "POST",
//           }
//         );
  
//         const result = await response.json();
  
//         console.log(result)
  
//         if (result.status === "success") {
//           // Player score updated
//         } else if (result.status === "error") {
//           // Player doesn't exist, prompt for account creation
//           console.log(result.message)
//         } else {
//           console.error(result.message);
//         }
//       } catch (error) {
//         console.error("Error logging in:", error);
//       }
// }

export async function saveSpiritDataToDb(dbSheetURL, playerId, spiritPoints, vitality, focus, adaptability){
  try {
      const response = await fetch(
        `${dbSheetURL}?request=updateSpiritData&id=${playerId}&spiritPoints=${spiritPoints}&vitality=${vitality}&focus=${focus}&adaptability=${adaptability}`,{
          method: "POST",
        }
      );

      const result = await response.json();

      console.log(result)

      if (result.status === "success") {
        // Player Spirit data updated
      } else if (result.status === "error") {
        // Player doesn't exist
        console.log(result.message)
      } else {
        console.error(result.message);
      }
    } catch (error) {
      console.error("Error logging in:", error);
    }
}