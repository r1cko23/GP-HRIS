
-- =============================================
-- Author:		Nianz
-- Create date: 2023.July.04 @ 04:03
-- Description:	List of payroll summary
-- =============================================
CREATE PROCEDURE [dbo].[usp_clientbranchpositionListclickbilling] 
	-- Add the parameters for the stored procedure here
		@idclientbranchposition INT
		--@idclientp INT, 
		--@Date_Start DateTime
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

    -- Select statements for procedure here
	--DECLARE
	--	@idpayrollsum INT, 
	--	@idclientp INT, 
	--	@Date_Start DateTime

	--SET @idpayrollsum = 403 
	--SET @idclientp = 15 
	--SET @Date_Start = '2022-12-01'

	select idbranchposition, 
					department, 
					jobposition,  
					fixrate,
					fixmonthlyrate,
					dailyratedivisorbilling,
					divisorfactor,
					billingallowance,
					billingdailyratepayroll, 
					billinghourlyrate, 
					dailyratepayroll, 
					regularOTrate,					
					billingregularOTrate,

					nightdiffrate,
					billingnightdiffrate, 
					
					regularnightdiffOTrate,
					billingregularnightdiffrate,
					
					
					legalholidayrate,
					billinglegalholidayrate,

					legalholidayrate2,
					billinglegalholidayrate2,
					
					legalholidayOTrate,
					billinglegalholidayOTrate, 

					legalholidayNDrate,
					billinglegalholidayNDrate, 

					lhotndrate,
					billinglhotndrate, 
					

					specialholidayrate,					
					billingspecialholidayrate, 

					specialholidayrate2,
					billingspecialholidayrate2,


					specialholidayOTrate,
					billingspecialholidayOTrate, 
					
					specialholidaynightdiffrate,
					billingspecialholidaynightdiffrate, 
					
					shotndrate,
					billingshotndrate, 
					
					
					RDrate,
					billingRDrate,

					rdotrate,
					billingrdotrate, 

					rdndrate,
					billingrdndrate, 

					rdndotrate,
					billingrdndotrate,

					
					lhwdorate,					
					billingLHWDORATE, 

					lhwdootrate,
					billingLHWDOOTRATE, 

					lhwdondrate,
					billingLHWDONDRATE, 

					lhwdootndrate,
					billingLHWDOOTNDRATE,
					
					
					wdoshrate,
					billingWDOSHRATE, 

					wdoshotrate,
					billingWDOSHOTRATE,

					wdoshndrate,
					billingWDOSHNDRATE,

					wdoshotndrate,
					billingWDOSHOTNDRATE, 
					
					WDOrate,
					billingWDOrate, 


					groupname,
					BillingDepartment,
					sheetname,
					billingtardinessrate,
					tagpositiondelete,
					billingdailyratepayroll,
					allowance


                   FROM client_branch_position 
                   WHERE idbranchposition= @idclientbranchposition 			
  END
