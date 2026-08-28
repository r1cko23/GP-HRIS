
-- =============================================
-- Author:		PAts Relos
-- Create date: 2023.July.04 @ 04:03
-- Description:	List of Timekeeeping CLick
-- =============================================
CREATE PROCEDURE [dbo].[sp_tkauditforedit] 
	-- Add the parameters for the stored procedure here
		@idtimekeep INT
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

	SELECT idtimekeep
	, idclient
	, DateStart
	,employeeid
	,lname2 +' ' + fname2 as empname
	,dailyrate_payroll
	,actualregularhours		
	,noofhourswork 
	,overtime_hours 
	,Nightdiff_Hours
	,regularnightshiftOT_hours
	
	,legalholiday_hours
	,legalHolidayOT_Hours
	,LegalHolidayND_Hours
	,lhotndh

	,LegalHoliday2_Hours

	,Holiday_Special_Hours
	,Holiday_SpecialOT_Hours
	,Holiday_SpecialND_Hours 
	,shotndh

	,Holiday_Special2_Hours

	,rdhours
	,RDothours
	,rdndhours
	,rdotndhours

	,lhwdohours
	,lhwdoothours
	,lhwdondhours
	,lhwdootndhours

	,shwdohours
	,shwdoothours
	,shwdondhours
	,shwdootndhours

	,WDOhours
	,lhrdothours
	,shrdothours


	,regrate 
	,regotrate 
	,regndrate 
	,regndotrate 
	
	,lhrate 
	,lhotrate 
	,lhndrate 
	,lhndotrate 

	,lh2rate

	
	,shrate 
	,shotrate
	,shndrate 
	,shndotrate 

	,sh2rate
	
	,rdrate
	,rdotrate
	,rdndrate
	,rdndotrate
	
	,lhwdorate
	,lhwdootrate
	,lhwdondrate
	,lhwdondotrate
	
	,shwdorate
	,shwdootrate
	,shwdondrate
	,shwdondotrate

	,wdorate
	,lhrdotrate
	,shrdotrate


	,UH
	,uhrate	
	,allowance
	,incomeadjustment
	,tardiness 
	,food
	,charges
	,totaldeduction
	,uniformshortage
	,shortage
	,nameplate


	,remarks
	,allowancenb
	,incomeadjustmentnb


	,createdby
	,createddate
	,updateby
	,lastupdate
	
	


	

--	,SHNightdiffOT_Hours 
	
	
--	,SHonRDOThours 
--	,LHonRDOThours 
--	,RDhours 
	
	
	FROM
		tbl_timekeep 
	WHERE 
		id = @idtimekeep
	ORDER BY 
		Employeeid
                    
END
