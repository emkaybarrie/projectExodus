const stageLibrary = {
  regions: {
      1: {
          zones: {
              1: {
                  sectors: {
                      1: {  name: 'Enarian Medaows',
                            regionId: 1,
                            zoneId: 1,
                            sectorId: 1,
                            numberOfLayers: 9, 
                            parallaxSpeeds: [0.2, 0.05, 0.15, 0.15, 0.1, 0.05, 0.025, 0.005, 0.001], 
                            otherInfo: {} 
                      },
                  }
              },
              2: {
                  sectors: {
                      1: {  name: 'Enarian Plains',
                            regionId: 1,
                            zoneId: 2,
                            sectorId: 1,
                            numberOfLayers: 4, 
                            parallaxSpeeds: [0.05, 0.025, 0.012, 0.01],  
                            otherInfo: {} 
                      },
                      2: {  name: 'Enarian Fields',
                            regionId: 1,
                            zoneId: 2,
                            sectorId: 2,
                            numberOfLayers: 4, 
                            parallaxSpeeds: [0.05, 0.025, 0.012, 0.01], 
                            otherInfo: {} 
                      },
                  }
              },
              3: {
                sectors: {
                    1: {  name: 'Enarian Pass',
                          regionId: 1,
                          zoneId: 3,
                          sectorId: 1,
                          numberOfLayers: 4, 
                          parallaxSpeeds: [0.025, 0.0125, 0.006, 0.005],  
                          otherInfo: {} 
                    },
                }
            },
          }
      },
      2: {
          zones: {
              1: {
                  sectors: {
                      1: { numberOfLayers: 8, parallaxSpeeds: [1, 0.8, 0.6, 0.4, 0.2, 0.1], otherInfo: {} }
                  }
              },
              3: {
                  sectors: {
                      1: { numberOfLayers: 10, parallaxSpeeds: [1, 0.5, 0.4, 0.3, 0.2, 0.15, 0.1, 0.05, 0.02], otherInfo: {} }
                  }
              }
          }
      }
  }
};

export function getStageConfigData(options = {}, stageLibraryData = stageLibrary) {
  const { regionId, zoneId, sectorId } = options;

  // Fetch available regions, zones, and sectors
  const regions = Object.keys(stageLibraryData.regions);
  const getRandom = (array) => array[Math.floor(Math.random() * array.length)];

  // Determine the target region
  const region = regionId ? stageLibraryData.regions[regionId] : stageLibraryData.regions[getRandom(regions)];
  if (!region) throw new Error(`Region ${regionId || 'random'} not found.`);

  const zones = Object.keys(region.zones);
  // Determine the target zone
  const zone = zoneId ? region.zones[zoneId] : region.zones[getRandom(zones)];
  if (!zone) throw new Error(`Zone ${zoneId || 'random'} not found in Region ${regionId || 'random'}.`);

  const sectors = Object.keys(zone.sectors);
  // Determine the target sector
  const sector = sectorId ? zone.sectors[sectorId] : zone.sectors[getRandom(sectors)];
  if (!sector) throw new Error(`Sector ${sectorId || 'random'} not found in Zone ${zoneId || 'random'} of Region ${regionId || 'random'}.`);

  // Return the stage configuration
  return sector;
}
