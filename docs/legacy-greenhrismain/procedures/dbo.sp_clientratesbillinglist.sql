CREATE PROCEDURE [dbo].[sp_clientratesbillinglist] 
    @keytext NVARCHAR(150),
    @idbranch INT,
    @idbranchposition INT,
    @tagdelete NVARCHAR(1)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        idbranchposition, 
        jobposition,
        BillingDepartment,
        groupname,
        sheetname,

        dailyratepayroll,
        billingdailyratepayroll,
        billinghourlyrate,

        billingregularOTrate,  
        regularOTrate,

        billingnightdiffrate,  
        nightdiffrate,
        billingregularnightdiffrate,  

        billinglegalholidayrate,  
        billinglegalholidayOTrate,  
        billinglegalholidayNDrate,  
        billinglhotndrate,  

		billinglegalholidayrate2,

        billingspecialholidayrate,  
        billingspecialholidayOTrate,  
        billingspecialholidaynightdiffrate,  
        billingshotndrate, 
		
		billingspecialholidayrate2,

        billingRDrate,
        billingrdotrate,  
        billingrdndrate,  
        billingrdndotrate,

        billingLHWDORATE,  
        billingLHWDOOTRATE,  
        billingLHWDONDRATE,  
        billingLHWDOOTNDRATE, 
		
		


        billingWDOSHRATE,  
        billingWDOSHOTRATE, 
        billingWDOSHNDRATE, 
        billingWDOSHOTNDRATE, 

        billingWDOrate,  

        connectedemp, 
        connectedpayroll, 
        connectedbilling, 

        fixrate,  
        fixmonthlyrate,  
        divisorfactor,
        billingallowance,
		allowance,
        dailyratedivisorbilling,
        billingtardinessrate,

        poscreatedby,
        posdatecreated,
        posupdateby,
        posdateupdate,
		bposupdateby,
        bposdateupdate,

        tagpositiondelete

    FROM client_branch_position  
    WHERE 
        idclientbranch = @idbranch
        AND tagpositiondelete = @tagdelete

        -- optional filter (search)
        AND (@keytext = '' OR jobposition LIKE '%' + @keytext + '%')

        -- optional filter (specific position)
        AND (@idbranchposition = 0 OR idbranchposition = @idbranchposition)

    ORDER BY jobposition;

END