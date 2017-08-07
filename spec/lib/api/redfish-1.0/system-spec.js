// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Redfish Systems Root', function () {
    var tv4;
    var validator;
    var redfish;
    var waterline;
    var Promise;
    var taskProtocol;
    var view;
    var fs;
    var nodeApi;
    var Errors;
    var racadm;
    var wsman;
    var configuration;
    var mktemp = require('mktemp');

    var xmlData = `<SystemConfiguration Model=" " ServiceTag=" " TimeStamp=" ">
<Component FQDD="BIOS.Setup.1-1">
    <Attribute Name="OldSetupPassword">xxxx</Attribute>
    <Attribute Name="NewSetupPassword">xxxx</Attribute>
    <Attribute Name="PasswordStatus">Unlocked</Attribute>
</Component>

</SystemConfiguration>`;

    var nodeObm = {
        id: "574dcd5794ab6e2506fd107a",
        node: "1234abcd1234abcd1234abcd",
        service: 'ipmi-obm-service',
        config: {
            host: '1.2.3.4',
            user: 'myuser',
            password: 'mypass'
        }
    };

    var node = {
        autoDiscover: false,
        id: '1234abcd1234abcd1234abcd',
        name: 'name',
        identifiers: ['1234'],
        tags: [],
        obms: [{ obm: '/api/2.0/obms/574dcd5794ab6e2506fd107a'}],
        type: 'compute',
        relations: [
            {
                relationType: 'enclosedBy',
                targets: [ '4567efgh4567efgh4567efgh' ]
            }
        ]
    };

    // var dellNodeObm ={
    //     id: "DELL574dcd5794ab6e2506fd107a",
    //     node: "DELLabcd1234abcd1234abcd",
    //     service: 'ipmi-obm-service',
    //     config: {
    //         host: '1.2.3.4',
    //         user: 'myuser',
    //         password: 'mypass'
    //    }
    // };

    var dellNode = {
        autoDiscover: false,
        id: 'DELLabcd1234abcd1234abcd',
        name: 'dell node',
        identifiers: ['ABCDEFG'],
        tags: [],
        obms: [{ obm: '/api/2.0/obms/DELL574dcd5794ab6e2506fd107a'}],
        type: 'compute',
        relations: [
            {
                relationType: 'enclosedBy',
                targets: [ '4567efgh4567efgh4567efgh' ]
            }
        ]
    };


    // Skip reading the entry from Mongo and return the entry directly
    function redirectGet(entry) {
        if( entry !== 'error.2.0.json') {
            entry = 'redfish-1.0/' + entry;
        }
        return fs.readFileAsync(__dirname + '/../../../../data/views/' + entry, 'utf-8')
            .then(function(contents) {
                return { contents: contents };
            });
    }

    helper.httpServerBefore();

    before(function () {
        view = helper.injector.get('Views');
        redfish = helper.injector.get('Http.Api.Services.Redfish');
        validator = helper.injector.get('Http.Api.Services.Schema');
        waterline = helper.injector.get('Services.Waterline');
        Promise = helper.injector.get('Promise');
        Errors = helper.injector.get('Errors');
        taskProtocol = helper.injector.get('Protocol.Task');
        nodeApi = helper.injector.get('Http.Services.Api.Nodes');
        racadm = helper.injector.get('JobUtils.RacadmTool');
        wsman = helper.injector.get('Http.Services.Wsman');
        configuration = helper.injector.get('Services.Configuration');
        var nodeFs = helper.injector.get('fs');
        fs = Promise.promisifyAll(nodeFs);
        tv4 = require('tv4');
    });

    beforeEach('set up mocks', function () {
        this.sandbox.stub(view, "get", redirectGet);
        this.sandbox.spy(redfish, 'render');
        this.sandbox.spy(redfish, 'validateSchema');
        this.sandbox.spy(validator, 'validate');
        this.sandbox.stub(waterline.nodes);
        this.sandbox.stub(waterline.catalogs);
        this.sandbox.stub(waterline.workitems);
        this.sandbox.stub(waterline.obms);
        this.sandbox.stub(taskProtocol);
        this.sandbox.stub(nodeApi, "setNodeWorkflowById");
        this.sandbox.stub(nodeApi, "getAllNodes");
        this.sandbox.stub(racadm, "runCommand");
        this.sandbox.stub(wsman, "getLog");
        this.sandbox.spy(tv4, "validate");
        this.sandbox.stub(mktemp, 'createFile');
        this.sandbox.stub(fs, 'writeFile');

        waterline.nodes.getNodeById.resolves();
        waterline.nodes.needByIdentifier.resolves();

        waterline.nodes.needByIdentifier.withArgs(node.id).resolves(Promise.resolve(node));
        waterline.nodes.needByIdentifier.withArgs(dellNode.id).resolves(Promise.resolve(dellNode));

        waterline.nodes.getNodeById.withArgs(node.id).resolves(Promise.resolve(node));
        waterline.nodes.getNodeById.withArgs(dellNode.id).resolves(Promise.resolve(dellNode));

        waterline.catalogs.findLatestCatalogOfSource.rejects(new Errors.NotFoundError());
        nodeApi.setNodeWorkflowById.resolves({instanceId: 'abcdef'});

        waterline.obms.findByNode.withArgs(node.id, 'ipmi-obm-service', true).resolves(Promise.resolve(nodeObm));

        mktemp.createFile.withArgs('/nfs/XXXXXX.xml')
        .resolves(Promise.resolve('/nfs/file.xml'));
        fs.writeFile.withArgs('/nfs/file.xml',xmlData, function() {})
        .resolves(Promise.resolve(undefined));
    });

    helper.httpServerAfter();


    var catalogData = {
        dmi: {
            chassis : {
                asset_tag: 'test'
            },
            system: {
                Manufacturer: 'test',
                sku_number: 'test',
                product_name: 'test',
                serial_number: 'test',
                uuid: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA'
            },
            bios: {
                version : "S2S_3A14         ",
                release_date : "09/18/2014",
                bios_revision : "5.6"
            },
            processor: {
                version: 'test'
            }
        },
        ohai: {
            network: {
                interfaces: {
                    eth0: {
                        addresses: {
                            "2C:60:0C:6F:B4:AF": {
                                family: "lladdr"
                            }
                        }
                    },
                    eth1: {
                        addresses: {
                            "172_31_128_19": {
                                broadcast: "172.31.131.255",
                                family: "inet",
                                netmask: "255.255.252.0",
                                scope: "Global"
                            },
                            "2C:60:0C:6F:B4:B0": {
                                family: "lladdr"
                            },
                            "fe80::2e60:cff:fe6f:b4b0": {
                                family: "inet6",
                                scope: "Link"
                            }
                        },
                        mtu: "1500",
                        state: "up",
                        type: "eth"
                    },
                    lo: {
                        encapsulation: "Loopback",
                        mtu: "65536",
                        state: "down"
                    }
                }
            }
        },
        cpu: {
            real: "1",
            0: {
                vendor_id: 'test'
            }
        },
        Redfish: [

        ],
        kernel: {
            machine: 'x86_64'
        },
        'Memory Device': [
            {
                Size: '16384 MB'
            }
        ],
        'Processor Information' : [
            {
                'Socket Designation': 'test',
                Manufacturer: 'test',
                'Max Speed': '2300 MHz',
                'Core Count': '10',
                'Thread Count': '20',
                Version: 'Intel(R) Xeon(R) CPU E5-2650 v3 @ 2.30GHz',
                ID: 'test',
                'Status': 'Populated, Enabled',
                Family: 'test'
            },
            {
                "Asset Tag": "Not Specified",
                "Characteristics": "None",
                "Current Speed": "Unknown",
                "External Clock": "Unknown",
                Family: "<OUT OF SPEC>",
                ID: "test2",
                "L1 Cache Handle": "Not Provided",
                "L2 Cache Handle": "Not Provided",
                "L3 Cache Handle": "Not Provided",
                Manufacturer: "Not Specified",
                "Max Speed": "Unknown",
                "Part Number": "Not Specified",
                "Serial Number": "Not Specified",
                "Socket Designation": "SOCKET 1",
                "Status": "Unpopulated",
                "Type": "<OUT OF SPEC>",
                "Upgrade": "<OUT OF SPEC>",
                Version: "Not Specified",
                "Voltage": "Unknown"
            }
        ]
    };

    var dellCatalogData =
    {
        bios: {
            "dcimBIOSEnumerationTypeList": [
                {
                    "any": [],
                    "attributeDisplayName": {
                        "otherAttributes": {},
                        "value": "System Memory Testing"
                    },
                    "attributeName": {
                        "otherAttributes": {},
                        "value": "MemTest"
                    },
                    "caption": null,
                    "currentValue": [
                        {
                            "otherAttributes": {},
                            "value": "Disabled"
                        }
                    ],
                    "isReadOnly": {
                        "otherAttributes": {},
                        "value": "false"
                    }
                }
            ]
        },
        DeviceSummary: {
            id: "1.2.3.4"
        },
        hardware: {
        },
        nics: [
            {
                "autoNegotiation": "2",
                "busNumber": "5",
                "controllerBiosVersion": null,
                "currentMACAddress": "F8:BC:12:0B:0B:40",
                "dataBusWidth": "0002",
                "deviceDescription": "Integrated NIC 1 Port 1 Partition 1",
                "deviceNumber": "0",
                "familyDriverVersion": "16.5.20",
                "familyVersion": "16.5.20",
                "fcoEOffloadMode": "3",
                "fcoEWwnn": null,
                "fqdd": "NIC.Integrated.1-1-1",
                "id": 0,
                "iscsiBootMode": null,
                "iscsiInitiatorGateway": null,
                "iscsiInitiatorIpAddress": null,
                "iscsiInitiatorName": null,
                "iscsiInitiatorPrimaryDns": null,
                "iscsiInitiatorSecondryDns": null,
                "iscsiInitiatorSubnet": null,
                "iscsiMacAddress": null,
                "iscsiOffloadMode": "3",
                "iscsiOffloadSupport": null,
                "legacyBootProtocol": null,
                "linkDuplex": "1",
                "linkSpeed": "3",
                "linkStatus": null,
                "macAddress": null,
                "maxBandwidth": "0",
                "mediaType": "Base T",
                "minBandwidth": "0",
                "nicMode": "3",
                "osDriverState": null,
                "pciDeviceID": "1521",
                "pciSubDeviceID": "1028",
                "permanentFcoMacAddress": "F8:BC:12:0B:0B:40",
                "permanentMacAddress": "F8:BC:12:0B:0B:40",
                "permanentiScsiMacAddress": "",
                "productName": "Intel(R) Gigabit 4P X710/I350 rNDC - F8:BC:12:0B:0B:40",
                "receiveFlowControl": "2",
                "slotLength": "0002",
                "slotType": "0002",
                "teaming": "< NIC # > , < NIC # >",
                "toeSupport": null,
                "transmitFlowControl": "3",
                "vendorName": "Intel Corp",
                "virtWwn": null,
                "virtWwpn": null,
                "virtualIscsiMacAddress": null,
                "virtualMacAddress": null,
                "wwn": null,
                "wwpn": null
            },
            {
                "autoNegotiation": "2",
                "busNumber": "5",
                "controllerBiosVersion": null,
                "currentMACAddress": "F8:BC:12:0B:0B:41",
                "dataBusWidth": "0002",
                "deviceDescription": "Integrated NIC 1 Port 2 Partition 1",
                "deviceNumber": "0",
                "familyDriverVersion": "16.5.20",
                "familyVersion": "16.5.20",
                "fcoEOffloadMode": "3",
                "fcoEWwnn": null,
                "fqdd": "NIC.Integrated.1-2-1",
                "id": 0,
                "iscsiBootMode": null,
                "iscsiInitiatorGateway": null,
                "iscsiInitiatorIpAddress": null,
                "iscsiInitiatorName": null,
                "iscsiInitiatorPrimaryDns": null,
                "iscsiInitiatorSecondryDns": null,
                "iscsiInitiatorSubnet": null,
                "iscsiMacAddress": null,
                "iscsiOffloadMode": "3",
                "iscsiOffloadSupport": null,
                "legacyBootProtocol": null,
                "linkDuplex": "1",
                "linkSpeed": "3",
                "linkStatus": null,
                "macAddress": null,
                "maxBandwidth": "0",
                "mediaType": "Base T",
                "minBandwidth": "0",
                "nicMode": "3",
                "osDriverState": null,
                "pciDeviceID": "1521",
                "pciSubDeviceID": "1028",
                "permanentFcoMacAddress": "F8:BC:12:0B:0B:41",
                "permanentMacAddress": "F8:BC:12:0B:0B:41",
                "permanentiScsiMacAddress": "",
                "productName": "Intel(R) Gigabit 4P X710/I350 rNDC - F8:BC:12:0B:0B:41",
                "receiveFlowControl": "2",
                "slotLength": "0002",
                "slotType": "0002",
                "teaming": "< NIC # > , < NIC # >",
                "toeSupport": null,
                "transmitFlowControl": "3",
                "vendorName": "Intel Corp",
                "virtWwn": null,
                "virtWwpn": null,
                "virtualIscsiMacAddress": null,
                "virtualMacAddress": null,
                "wwn": null,
                "wwpn": null
            }
        ]
    };

    var catalogDataWithBadProcessor = {
        'Processor Information' : [
            {
                "Asset Tag": "Not Specified",
                "Characteristics": "None",
                "Current Speed": "Unknown",
                "External Clock": "Unknown",
                Family: "<OUT OF SPEC>",
                ID: "test2",
                "L1 Cache Handle": "Not Provided",
                "L2 Cache Handle": "Not Provided",
                "L3 Cache Handle": "Not Provided",
                Manufacturer: "Not Specified",
                "Max Speed": "Unknown",
                "Part Number": "Not Specified",
                "Serial Number": "Not Specified",
                "Socket Designation": "SOCKET 1",
                "Status": "Unpopulated",
                "Type": "<OUT OF SPEC>",
                "Upgrade": "<OUT OF SPEC>",
                Version: "Not Specified",
                "Voltage": "Unknown"
            }
          ]
    };

    var redfishCatalog = {
        Redfish: {
            "@odata_context": "/redfish/v1/$metadata#SimpleStorage.SimpleStorage",
            "@odata_id": "/redfish/v1/Systems/System.Embedded.1/Storage/Controllers/AHCI.Embedded.1-1",
            "@odata_type": "#SimpleStorage.v1_0_2.SimpleStorage",
            "Description": "Simple Storage Controller",
            "Devices": [
                {
                    "Manufacturer": "INTEL",
                    "Model": "DSC2BX800G4R",
                    "Name": "Solid State Disk 0:0",
                    "Status": {
                        "Health": null,
                        "HealthRollUp": null,
                        "State": "Enabled"
                    }
                },
                {
                    "Manufacturer": "INTEL",
                    "Model": "DSC2BX800G4R",
                    "Name": "Solid State Disk 1:1",
                    "Status": {
                        "Health": null,
                        "HealthRollUp": null,
                        "State": "Enabled"
                    }
                },
                {
                    "Manufacturer": "INTEL",
                    "Model": "DSC2BX800G4R",
                    "Name": "Solid State Disk 2:2",
                    "Status": {
                        "Health": null,
                        "HealthRollUp": null,
                        "State": "Enabled"
                    }
                }
            ],
            "Devices@odata_count": 3,
            "Id": "AHCI.Embedded.1-1",
            "Name": "C610/X99 series chipset sSATA Controller [AHCI mode]",
            "Status": {
                "Health": null,
                "HealthRollUp": null,
                "State": "Enabled"
            },
            "UEFIDevicePath": "PciRoot(0x0)/Pci(0x11,0x4)"
        }
    };
    var redfishCatalogArray = [
        {
            data: {
                "@odata_context": "/redfish/v1/$metadata#SimpleStorage.SimpleStorage",
                "@odata_id": "/redfish/v1/Systems/System.Embedded.1/Storage/Controllers/AHCI.Embedded.1-1",
                "@odata_type": "#SimpleStorage.v1_0_2.SimpleStorage",
                "Description": "Simple Storage Controller",
                "Devices": [
                    {
                        "Manufacturer": "INTEL",
                        "Model": "DSC2BX800G4R",
                        "Name": "Solid State Disk 0:0",
                        "Status": {
                            "Health": null,
                            "HealthRollUp": null,
                            "State": "Enabled"
                        }
                    },
                    {
                        "Manufacturer": "INTEL",
                        "Model": "DSC2BX800G4R",
                        "Name": "Solid State Disk 1:1",
                        "Status": {
                            "Health": null,
                            "HealthRollUp": null,
                            "State": "Enabled"
                        }
                    },
                    {
                        "Manufacturer": "INTEL",
                        "Model": "DSC2BX800G4R",
                        "Name": "Solid State Disk 2:2",
                        "Status": {
                            "Health": null,
                            "HealthRollUp": null,
                            "State": "Enabled"
                        }
                    }
                ],
                "Devices@odata_count": 3,
                "Id": "AHCI.Embedded.1-1",
                "Name": "C610/X99 series chipset sSATA Controller [AHCI mode]",
                "Status": {
                    "Health": null,
                    "HealthRollUp": null,
                    "State": "Enabled"
                },
                "UEFIDevicePath": "PciRoot(0x0)/Pci(0x11,0x4)"

            }
        }
    ];


    var smartCatalog = [
        {
            SMART: {
                Identity: {
                }
            },
            Controller: {
                controller_PCI_BDF : "0000:00:01.1"
            }
        }
    ];

    var wsmanSelLog = [
        {
            "creationTimeStamp": "20161206135247.000000-360",
            "elementName": "System Event Log Entry",
            "instanceID": "DCIM:SEL:Entry:23",
            "logInstanceID": "DCIM:SEL:1",
            "logName": "System Event Log",
            "perceivedSeverity": "2",
            "recordData": "Drive 0 is installed in disk drive bay 1.",
            "recordFormat": "string Description",
            "recordID": "23"
        }
    ];

    var wsmanLcLog = [
        {
            "recordId": 1234567,
            "logName": "LifeCycle Log",
            "creationTimeStamp": "20170520141756.000000-300",
            "message": "Successfully logged in using root, from 100.68.124.32 and REDFISH.",
            "severity": "2",
            "category": "Audit",
            "messageId": "USR0030",
            "elementName": "USR0030",
            "instanceId": "DCIM:LifeCycleLog:2173760",
            "logInstanceId": "DCIM:LifeCycleLog",
            "comment": "[set comment here]",
            "agentId": "RACLOG",
            "configResultsAvailable": "false",
            "fqdd": "iDRAC.Embedded.1",
            "messageArguments": "REDFISH",
            "owningEntity": "DCIM",
            "rawEventData": "",
            "sequenceNumber": 2173760
        }
    ];

    var httpEndpoints = [
        {
            "address": "172.31.128.1",
            "authEnabled": false,
            "httpsEnabled": false,
            "port": 9080,
            "proxiesEnabled": true,
            "routers": "southbound-api-router"
        }
    ];

    it('should return a valid system root', function () {
        waterline.nodes.find.resolves([node]);
        return helper.request().get('/redfish/v1/Systems')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
                expect(res.body['Members@odata.count']).to.equal(1);
                expect(res.body.Members[0]['@odata.id']).to.equal('/redfish/v1/Systems/' + node.id);
            });
    });

    it('should return a valid system', function() {
        waterline.catalogs.findLatestCatalogOfSource.resolves(Promise.resolve({
            node: node.id,
            source: 'dummysource',
            data: catalogData
        }));

        waterline.workitems.findPollers.resolves([{
            config: { command: 'chassis' }
        }]);

        taskProtocol.requestPollerCache.resolves([{
            chassis: { power: "Unknown", uid: "Reserved"}
        }]);

        return helper.request().get('/redfish/v1/Systems/' + node.id)
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return a valid system with sku', function() {
        waterline.nodes.needByIdentifier.withArgs(node.id)
        .resolves(Promise.resolve({
            id: node.id,
            name: node.id,
            sku: 'sku-value'
        }));

        waterline.catalogs.findLatestCatalogOfSource.resolves(Promise.resolve({
            node: node.id,
            source: 'dummysource',
            data: catalogData
        }));

        waterline.workitems.findPollers.resolves([{
            config: { command: 'chassis' }
        }]);

        taskProtocol.requestPollerCache.resolves([{
            chassis: { power: "Unknown", uid: "Reserved"}
        }]);

        return helper.request().get('/redfish/v1/Systems/' + node.id)
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid system', function() {
        return helper.request().get('/redfish/v1/Systems/bad' + node.id)
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should 404 an invalid identifier for bios query', function() {
        return helper.request().get('/redfish/v1/Systems/bad' + node.id + '/Bios')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should 404 a non-Dell identifier for bios query', function() {
        return helper.request().get('/redfish/v1/Systems/' + node.id + '/Bios')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid bios block for Dell-based catalog', function() {
        waterline.catalogs.findLatestCatalogOfSource.withArgs(dellNode.id, 'bios').resolves(Promise.resolve({
            node: dellNode.id,
            source: 'bios',
            data: dellCatalogData.bios
        }));
        return helper.request().get('/redfish/v1/Systems/' + dellNode.id + '/Bios')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid identifier for bios settings query', function() {
        return helper.request().get('/redfish/v1/Systems/bad' + node.id + '/Bios/Settings')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should 404 a non-Dell identifier for bios settings query', function() {
        return helper.request().get('/redfish/v1/Systems/' + node.id + '/Bios/Settings')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid bios settings block for Dell-based catalog', function() {
        waterline.catalogs.findLatestCatalogOfSource.withArgs(dellNode.id, 'bios').resolves(Promise.resolve({
            node: dellNode.id,
            source: 'bios',
            data: dellCatalogData.bios
        }));
        return helper.request().get('/redfish/v1/Systems/' + dellNode.id + '/Bios/Settings')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid system for bios settings patch', function() {
        return helper.request().patch('/redfish/v1/Systems/bad' + node.id + '/Bios/Settings')
            .send({ Name: "bogusname", Id: "someid"})
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should 404 non-Dell identifier for bios settings patch', function() {
        return helper.request().patch('/redfish/v1/Systems/' + node.id + '/Bios/Settings')
            .send({ Name: "bogusname", Id: "someid"})
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should 202 for a Dell-based bios settings patch', function() {
        // Force a southbound interface through httpEndpoints
        configuration.set('httpEndpoints', httpEndpoints);
        waterline.catalogs.findLatestCatalogOfSource.withArgs(dellNode.id, 'DeviceSummary').resolves(Promise.resolve({
            node: dellNode.id,
            source: 'DeviceSummary',
            data: dellCatalogData.DeviceSummary
        }));
        return helper.request().patch('/redfish/v1/Systems/' + dellNode.id + '/Bios/Settings')
            .send({ "@odata.context": "string", "@odata.id": "string", "@odata.type": "string", "Actions": { "Oem": {} }, "AttributeRegistry": "string", "Attributes": { "X": "y"}, "Description": "string", "Id": "string", "Name": "string", "Oem": {} })
            .expect('Content-Type', /^application\/json/)
            .expect(202);
    });

    it('should 404 an invalid system for Bios.ChangePassword post', function() {
        return helper.request().post('/redfish/v1/Systems/bad' + node.id + '/Bios.ChangePassword')
            .send({ PasswordName: "bogusname", OldPassword: "somepass", NewPassword: "newpass"})
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should 404 an non-Dell system for Bios.ChangePassword post', function() {
        return helper.request().post('/redfish/v1/Systems/' + node.id + '/Bios.ChangePassword')
            .send({ PasswordName: "bogusname", OldPassword: "somepass", NewPassword: "newpass"})
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should 202 for a Dell-based bios change password SysPassword', function() {
        // Force a southbound interface through httpEndpoints
        configuration.set('httpEndpoints', httpEndpoints);
        waterline.catalogs.findLatestCatalogOfSource.withArgs(dellNode.id, 'DeviceSummary').resolves(Promise.resolve({
            node: dellNode.id,
            source: 'DeviceSummary',
            data: dellCatalogData.DeviceSummary
        }));
        return helper.request().post('/redfish/v1/Systems/' + dellNode.id + '/Bios.ChangePassword')
            .send({ PasswordName: "SysPassword", OldPassword: "somepass", NewPassword: "newpass"})
            .expect('Content-Type', /^application\/json/)
            .expect(202);
    });

    it('should 202 for a Dell-based bios change password SetupPassword', function() {
        // Force a southbound interface through httpEndpoints
        configuration.set('httpEndpoints', httpEndpoints);
        waterline.catalogs.findLatestCatalogOfSource.withArgs(dellNode.id, 'DeviceSummary').resolves(Promise.resolve({
            node: dellNode.id,
            source: 'DeviceSummary',
            data: dellCatalogData.DeviceSummary
        }));
        return helper.request().post('/redfish/v1/Systems/' + dellNode.id + '/Bios.ChangePassword')
            .send({ PasswordName: "SetupPassword", OldPassword: "somepass", NewPassword: "newpass"})
            .expect('Content-Type', /^application\/json/)
            .expect(202);
    });

    it('should 400 an invalid password name for Bios.ChangePassword post', function() {
        waterline.catalogs.findLatestCatalogOfSource.withArgs(dellNode.id, 'DeviceSummary').resolves(Promise.resolve({
            node: dellNode.id,
            source: 'DeviceSummary',
            data: dellCatalogData.DeviceSummary
        }));
        return helper.request().post('/redfish/v1/Systems/' + dellNode.id + '/Bios.ChangePassword')
            .send({ PasswordName: "bogusname", OldPassword: "somepass", NewPassword: "newpass"})
            .expect('Content-Type', /^application\/json/)
            .expect(400);
    });

    /*
        **** EthernetInterface - General
    */

    it('should 404 an invalid identifier for ethernet query', function() {
        return helper.request().get('/redfish/v1/Systems/' + 'bad' + node.id + '/EthernetInterfaces')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    /*
        **** EthernetInterface - DELL
    */

    it('should 200 a Dell identifier for ethernet query', function() {
        waterline.catalogs.findLatestCatalogOfSource.withArgs(dellNode.id, 'nics').resolves(Promise.resolve({
            node: dellNode.id,
            source: 'nics',
            data: dellCatalogData.nics
        }));
        return helper.request().get('/redfish/v1/Systems/' + dellNode.id + '/EthernetInterfaces')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return a valid ethernet index block for Dell-based catalog with valid index', function() {
        waterline.catalogs.findLatestCatalogOfSource.withArgs(dellNode.id, 'nics').resolves(Promise.resolve({
            node: dellNode.id,
            source: 'nics',
            data: dellCatalogData.nics
        }));
        return helper.request().get('/redfish/v1/Systems/' + dellNode.id + '/EthernetInterfaces/' + 'NIC.Integrated.1-1-1')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 a DELL with valid index and invalid ethernet index', function() {
        waterline.catalogs.findLatestCatalogOfSource.withArgs(dellNode.id, 'nics').resolves(Promise.resolve({
            node: dellNode.id,
            source: 'nics',
            data: dellCatalogData.nics
        }));
        return helper.request().get('/redfish/v1/Systems/' + dellNode.id + '/EthernetInterfaces/' + 'BAD' + 'NIC.Integrated.1-1-1')
            .expect('Content-Type', /^application\/json/)
            .expect(404)
            .expect(function() {
                expect(tv4.validate.called).to.be.false;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    /* 
        **** EthernetInterface - Non-DELL
    */

    it('should 200 a non-Dell identifier for ethernet query', function() {
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node.id, 'ohai').resolves(Promise.resolve({
            node: node.id,
            source: 'ohai',
            data: catalogData.ohai
        }));
        return helper.request().get('/redfish/v1/Systems/' + node.id + '/EthernetInterfaces')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return a valid ethernet index block for non-Dell catalog with valid index', function() {
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node.id, 'ohai').resolves(Promise.resolve({
            node: node.id,
            source: 'ohai',
            data: catalogData.ohai
        }));
        return helper.request().get('/redfish/v1/Systems/' + node.id + '/EthernetInterfaces/' + 'eth0')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 a non-DELL with valid index and invalid ethernet index', function() {
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node.id, 'ohai').resolves(Promise.resolve({
            node: node.id,
            source: 'ohai',
            data: catalogData.ohai
        }));
        return helper.request().get('/redfish/v1/Systems/' + node.id + '/EthernetInterfaces/' + 'BADi' + 'eth0')
            .expect('Content-Type', /^application\/json/)
            .expect(404)
            .expect(function() {
                expect(tv4.validate.called).to.be.false;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    /* 
        **** Processors
    */

    it('should return a valid processor list', function() {
        waterline.catalogs.findLatestCatalogOfSource.resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: catalogData
        }));

        return helper.request().get('/redfish/v1/Systems/' + node.id + '/Processors')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid processor list', function() {
        return helper.request().get('/redfish/v1/Systems/bad' + node.id + '/Processors')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should 404 an invalid processor list', function() {
        waterline.catalogs.findLatestCatalogOfSource.resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: catalogDataWithBadProcessor
        }));

        return helper.request().get('/redfish/v1/Systems/' + node.id + '/Processors')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid processor', function() {
        waterline.catalogs.findLatestCatalogOfSource.resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: catalogData
        }));

        return helper.request().get('/redfish/v1/Systems/' + node.id + '/Processors/0')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid processor', function() {
        return helper.request().get('/redfish/v1/Systems/' + node.id + '/Processors/bad')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });


    it('should return a valid simple storage list', function() {
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node.id, 'smart').resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: smartCatalog
        }));

        waterline.catalogs.findLatestCatalogOfSource.resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: catalogData
        }));

        return helper.request().get('/redfish/v1/Systems/' + node.id + '/SimpleStorage')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid simple storage', function() {
        return helper.request().get('/redfish/v1/Systems/bad' + node.id + '/SimpleStorage')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid simple storage device', function() {
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node.id, 'smart')
        .resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: smartCatalog
        }));

        waterline.catalogs.findLatestCatalogOfSource.resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: catalogData
        }));

        return helper.request().get('/redfish/v1/Systems/' + node.id +
                                    '/SimpleStorage/0000_00_01_1')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid simple storage device', function() {
        return helper.request().get('/redfish/v1/Systems/' + node.id +
                                    '/SimpleStorage/bad')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid log service', function() {
        return helper.request().get('/redfish/v1/Systems/' + node.id +
                                    '/LogServices')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return a valid sel log service', function() {
        waterline.workitems.findPollers.resolves([{
            config: { command: 'selInformation' }
        }]);

        taskProtocol.requestPollerCache.resolves([{
            selInformation: { '# of Alloc Units': 10, uid: "Reserved"}
        }]);

        return helper.request().get('/redfish/v1/Systems/' + node.id +
                                    '/LogServices/sel')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return a valid iDRAC sel log service', function() {
        wsman.getLog.withArgs(sinon.match.any, 'SEL').resolves(wsmanSelLog);
        return helper.request().get('/redfish/v1/Systems/' + dellNode.id +
                                    '/LogServices/sel')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid sel log service', function() {
        wsman.getLog.withArgs(sinon.match.any, 'SEL').resolves(wsmanSelLog);
        return helper.request().get('/redfish/v1/Systems/bad' + node.id +
                                    '/LogServices/sel')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid sel log service entry collection', function() {
        wsman.getLog.withArgs(sinon.match.any, 'SEL').resolves(wsmanSelLog);
        waterline.workitems.findPollers.resolves([{
            config: { command: 'sel' }
        }]);

        taskProtocol.requestPollerCache.resolves([{
            sel: [{
                logId: 'abcd',
                value: 'Assert',
                sensorType: 'Temperature',
                event: 'thermal event',
                sensorNumber: '#0x01',
                date: '01/01/1970',
                time: '01:01:01'
            }]
        }]);

        return helper.request().get('/redfish/v1/Systems/' + node.id +
                                    '/LogServices/sel/Entries')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return a valid iDRAC sel log service entry collection', function() {
        wsman.getLog.withArgs(sinon.match.any, 'SEL').resolves(wsmanSelLog);
        return helper.request().get('/redfish/v1/Systems/' + dellNode.id +
                                    '/LogServices/sel/Entries')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return an empty sel log service entry collection', function() {
        waterline.workitems.findPollers.resolves([{
            config: { command: 'sel' }
        }]);

        taskProtocol.requestPollerCache.resolves([{
            sel: undefined
        }]);

        return helper.request().get('/redfish/v1/Systems/' + node.id +
                                    '/LogServices/sel/Entries')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });


    it('should 404 an invalid sel log service entry list', function() {
        return helper.request().get('/redfish/v1/Systems/bad' + node.id +
                                    '/LogServices/sel/Entries')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid sel log service entry with Created keyword', function() {
        waterline.nodes.find.resolves([node]);
        waterline.workitems.findPollers.resolves([{
            config: { command: 'sel' }
        }]);

        taskProtocol.requestPollerCache.resolves([{
            sel: [{
                logId: 'abcd',
                value: 'Assert',
                sensorType: 'Temperature',
                event: 'Thermal Event',
                sensorNumber: '#0x01',
                date: '01/01/1970',
                time: '01:01:01'
            }]
        }]);

        return helper.request().get('/redfish/v1/Systems/' + node.id +
                                    '/LogServices/sel/Entries/abcd')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
                expect(res.body.Created).to.exist;
            });
    });

    it('should return a valid sel log service entry without Created keyword',function() {
        waterline.nodes.find.resolves([node]);
        waterline.workitems.findPollers.resolves([{
            config: { command: 'sel' }
        }]);

        taskProtocol.requestPollerCache.resolves([{
            sel: [{
                logId: 'abcd',
                value: 'Assert',
                sensorType: 'Temperature',
                event: 'Thermal Event',
                sensorNumber: '#0x01',
                date: '',
                time: ''
            }]
        }]);

        return helper.request().get('/redfish/v1/Systems/' + node.id +
                                    '/LogServices/sel/Entries/abcd')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
                expect(res.body.Created).to.not.exist;
            });
    });

    it('should return a valid sel log service entry despite no #', function() {
        waterline.nodes.find.resolves([node]);
        waterline.workitems.findPollers.resolves([{
            config: { command: 'sel' }
        }]);

        taskProtocol.requestPollerCache.resolves([{
            sel: [{
                logId: 'abcd',
                value: 'Assert',
                sensorType: 'Temperature',
                event: 'Thermal Event',
                sensorNumber: '1',
                date: '01/01/1970',
                time: '01:01:01'
            }]
        }]);

        return helper.request().get('/redfish/v1/Systems/' + node.id +
                                    '/LogServices/sel/Entries/abcd')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return a valid iDrac sel log service entry', function() {
        wsman.getLog.withArgs(dellNode, 'SEL').resolves(wsmanSelLog);
        return helper.request().get('/redfish/v1/Systems/' + dellNode.id +
                                    '/LogServices/sel/Entries/23')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid sel log service entry', function() {
        waterline.workitems.findPollers.resolves([{
            config: { command: 'sel' }
        }]);

        taskProtocol.requestPollerCache.resolves([{
            sel: [{
                logId: 'abcd',
                value: 'Assert',
                sensorType: 'Temperature',
                event: 'Thermal Event',
                sensorNumber: '1',
                date: '01/01/1970',
                time: '01:01:01'
            }]
        }]);

        return helper.request().get('/redfish/v1/Systems/' + node.id +
                                    '/LogServices/sel/Entries/abcdefg')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should 404 an invalid iDRAC sel log service entry', function() {
        wsman.getLog.withArgs(dellNode, 'SEL').resolves(wsmanSelLog);

        return helper.request().get('/redfish/v1/Systems/' + dellNode.id +
                                    '/LogServices/sel/Entries/abcdefg')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid reset type list', function() {
        return helper.request().get('/redfish/v1/Systems/' + node.id +
                                    '/Actions/ComputerSystem.Reset')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(view.get.called).to.be.true;
            });
    });

    it('should 404 a reset type list on an invalid node', function() {
        return helper.request().get('/redfish/v1/Systems/' + node.id +
                                    'invalid/Actions/ComputerSystem.Reset')
            .expect(404);
    });

    it('should perform the specified valid reset', function() {
        return helper.request().post('/redfish/v1/Systems/' + node.id +
                                    '/Actions/ComputerSystem.Reset')
            .send({ reset_type: "ForceRestart"})
            .expect('Content-Type', /^application\/json/)
            .expect(202)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(res.body['@odata.id']).to.equal('/redfish/v1/TaskService/Tasks/abcdef');
            });
    });

    it('should 404 a reset on an invalid node', function() {
        return helper.request().post('/redfish/v1/Systems/' + node.id +
                                    'invalid/Actions/ComputerSystem.Reset')
            .send({ reset_type: "ForceRestart"})
            .expect(404);
    });

    it('should 400 an invalid reset type', function() {
        return helper.request().post('/redfish/v1/Systems/' + node.id +
                                    '/Actions/ComputerSystem.Reset')
            .send({ reset_type: "HalfForceRestart"})
            .expect('Content-Type', /^application\/json/)
            .expect(400);
    });

    it('should return a valid boot image list', function() {
        return helper.request().get('/redfish/v1/Systems/' + node.id +
                                    '/Actions/RackHD.BootImage')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(view.get.called).to.be.true;
            });
    });

    it('should perform the specified boot image installation with minimum payload', function() {
        var minimumValidBody = {
            repo: "http://172.31.128.1:9080/esxi/5.5",
            version: "6.0",
            rootPassword: "passw0rd"
        };
        return Promise.map(['CentOS', 'CentOS+KVM', 'ESXi', 'RHEL', 'RHEL+KVM'], function(osName) {
            return helper.request().post('/redfish/v1/Systems/' + node.id +
                                        '/Actions/RackHD.BootImage')
                .send( _.merge(minimumValidBody, {osName: osName}) )
                .expect('Content-Type', /^application\/json/)
                .expect(202)
                .expect(function(res) {
                    expect(tv4.validate.called).to.be.true;
                    expect(validator.validate.called).to.be.true;
                    expect(redfish.validateSchema.called).to.be.true;
                    expect(res.body['@odata.id']).to.equal('/redfish/v1/TaskService/Tasks/abcdef');
                });
        });
    });

    it('should perform the specified boot image installation', function() {
        var minimumValidBody = {
            domain: "rackhd.com",
            hostname: "rackhd",
            osName: "ESXi",
            repo: "http://172.31.128.1:9080/esxi/5.5",
            version: "6.0",
            rootPassword: "passw0rd",
            dnsServers: [ "172.31.128.1" ],
            installDisk: "firstdisk",
            postInstallCommands:['touch a.txt', 'ls /var']
        };
        return Promise.map(['CentOS', 'CentOS+KVM', 'ESXi', 'RHEL', 'RHEL+KVM'], function(osName) {
            return helper.request().post('/redfish/v1/Systems/' + node.id +
                                        '/Actions/RackHD.BootImage')
                .send( _.merge(minimumValidBody, {osName: osName}) )
                .expect('Content-Type', /^application\/json/)
                .expect(202)
                .expect(function(res) {
                    expect(tv4.validate.called).to.be.true;
                    expect(validator.validate.called).to.be.true;
                    expect(redfish.validateSchema.called).to.be.true;
                    expect(res.body['@odata.id']).to.equal('/redfish/v1/TaskService/Tasks/abcdef');
                });
        });
    });

    it('should 400 an invalid boot image installation', function() {
        var minimumInvalidBody = {
            osName: "notESXi",
            repo: "http://172.31.128.1:9080/esxi/5.5",
            version: "6.0",
            rootPassword: "passw0rd"
        };

        return helper.request().post('/redfish/v1/Systems/' + node.id +
                                    '/Actions/RackHD.BootImage')
            .send(minimumInvalidBody)
            .expect('Content-Type', /^application\/json/)
            .expect(400);
    });

    it('should return valid SecureBoot status', function() {
        racadm.runCommand.resolves("test=SecureBoot=Disabled");
        return helper.request().get('/redfish/v1/Systems/'+ node.id +'/SecureBoot')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 500 on bad racadm command', function() {
        racadm.runCommand.rejects("ERROR");
        return helper.request().get('/redfish/v1/Systems/'+ node.id +'/SecureBoot')
            .expect('Content-Type', /^application\/json/)
            .expect(500);
    });

    it('should return 202 after setting Secure Boot', function() {
        racadm.runCommand.resolves( "test=SecureBoot=Disabled" );
        return helper.request().post('/redfish/v1/Systems/'+ node.id +'/SecureBoot')
            .send({"SecureBootEnable": true})
            .expect(202);
    });

    it('should 400 on bad request command', function() {
        return helper.request().post('/redfish/v1/Systems/'+ node.id +'/SecureBoot')
            .send({"zzzSecureBootEnable": true})
            .expect(400);
    });

    it('should 500 on failure', function() {
        racadm.runCommand.rejects("ERROR");
        return helper.request().post('/redfish/v1/Systems/'+ node.id +'/SecureBoot')
            .send({"SecureBootEnable": true})
            .expect(500);
    });

    it('should return a valid lc log service', function() {
        wsman.getLog.withArgs(sinon.match.any, 'LC').resolves(wsmanLcLog);
        return helper.request().get('/redfish/v1/Systems/' + dellNode.id +
                                    '/LogServices/lc')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid lc log service', function() {
        wsman.getLog.withArgs(sinon.match.any, 'LC').resolves(wsmanLcLog);
        return helper.request().get('/redfish/v1/Systems/bad' + node.id +
                                    '/LogServices/lc')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid lc log service entry collection', function() {
        wsman.getLog.withArgs(sinon.match.any, 'LC').resolves(wsmanLcLog);
        return helper.request().get('/redfish/v1/Systems/' + dellNode.id +
                                    '/LogServices/lc/Entries')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid lc log service entry collection', function() {
        wsman.getLog.withArgs(sinon.match.any, 'LC').resolves(wsmanLcLog);
        return helper.request().get('/redfish/v1/Systems/bad' + dellNode.id +
                                    '/LogServices/lc/Entries')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid lc log service entry', function() {
        wsman.getLog.withArgs(sinon.match.any, 'LC').resolves(wsmanLcLog);
        return helper.request().get('/redfish/v1/Systems/' + dellNode.id +
                                    '/LogServices/lc/Entries/1234567')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid lc log service entry', function() {
        wsman.getLog.withArgs(sinon.match.any, 'LC').resolves(wsmanLcLog);

        return helper.request().get('/redfish/v1/Systems/' + dellNode.id +
                                    '/LogServices/lc/Entries/abcdefg')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should 501 on lc service not supported', function() {
        return helper.request().get('/redfish/v1/Systems/' + node.id +
                                    '/LogServices/lc')
            .expect('Content-Type', /^application\/json/)
            .expect(501);
    });

    it('should 501 on lc entries not supported', function() {
        return helper.request().get('/redfish/v1/Systems/' + node.id +
                                    '/LogServices/lc/Entries')
            .expect('Content-Type', /^application\/json/)
            .expect(501);
    });

    it('should 501 on lc entry not supported', function() {
        return helper.request().get('/redfish/v1/Systems/' + node.id +
                                    '/LogServices/lc/Entries/abcdefg')
            .expect('Content-Type', /^application\/json/)
            .expect(501);
    });

    it('should return a valid  storage list', function() {

        waterline.catalogs.findLatestCatalogOfSource.withArgs(node.id, 'smart').resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dmi',
            data: smartCatalog
        }));

        waterline.catalogs.findLatestCatalogOfSource.resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dmi',
            data: catalogData
        }));

        return helper.request().get('/redfish/v1/Systems/' + node.id + '/Storage')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return a valid  Redfish storage list', function() {
        waterline.catalogs.find.resolves(Promise.resolve(redfishCatalogArray));

        return helper.request().get('/redfish/v1/Systems/' + node.id + '/Storage')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid storage', function() {
        return helper.request().get('/redfish/v1/Systems/bad' + node.id + '/Storage')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid storage device', function () {
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node.id, 'smart')
            .resolves(Promise.resolve({
                node: '1234abcd1234abcd1234abcd',
                source: 'dmi',
                data: smartCatalog
            }));

        waterline.catalogs.findLatestCatalogOfSource.resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dmi',
            data: catalogData
        }));

        return helper.request().get('/redfish/v1/Systems/' + node.id +
            '/Storage/0000_00_01_1')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function () {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return a valid Redfish storage device', function () {
        waterline.catalogs.find.resolves(Promise.resolve(redfishCatalogArray));


        return helper.request().get('/redfish/v1/Systems/' + node.id +
            '/Storage/AHCI.Embedded.1-1')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function () {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid  storage device', function () {
        waterline.catalogs.find.resolves([]);
        return helper.request().get('/redfish/v1/Systems/' + node.id +
            '/Storage/bad')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });


});

