
-- =============================================
-- Author:		Pat Relos
-- Create date: 2023.July.04 @ 04:03
-- Description:	list if employee store in timekeep data grid 
-- =============================================
create PROCEDURE [dbo].[sp_tkprocessupload] 
	-- Add the parameters for the stored procedure here
			
	@idtimekeep int,
	@idemployee int, 
	@fname nvarchar(50), 
	@lname nvarchar(50), 
	@idclient 	int,
	@iddepartment int,
	@idclientbranch int,
	@jobcode int,
	@dailyrate as float, 
	@datestart 	date, 
	@dateend 	date, 
	@payrolldate date, 
	@payrollmonth nvarchar(25),
	@payrollmonthsort int, 
	@tardiness as float, 
	@totalhours as float, 
	@reg as float, 
	@regot as float, 
	@regnd as float, 
	@regotnd as float, 
    @lh as float,  
    @lhot as float, 
    @lhnd as float, 
    @lhndot as float,
	@sh as float,  
    @shot as float, 
    @shnd as float, 
    @shndot as float,
	@rd as float,  
	@rdot as float,
	@rdnd as float,  
	@rdndot as float,
	@lhwdo as float,
    @lhwdoot as float,
    @lhwdond as float, 
    @lhwdondot as float,
	@shwdo as float,
    @shwdoot as float,
    @shwdond as float, 
    @shwdondot as float,
	@totalotherincome as float,
	@totaldeduction as float,
    @paythrough nvarchar(30),
    @bankaccountno nvarchar(30),
    @bankname nvarchar(30),
	@sssbasis nvarchar(30),
	@phibasis nvarchar(30),
	@schedsss nvarchar(30)
                                                                               
	
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	BEGIN TRY
		BEGIN TRANSACTION; -- Start a transaction to rollback changes in case of an error


INSERT INTO tbl_timekeep (
    idtimekeep
    ,employeeid
	,fname2
	,lname2
	,datestart
	,dateend
	,payrolldate
	,payrollmonth
	,payrollmonthsort
	,idclient
	,departmentcode
	,idclientbranch
	,idposition
	,dailyrate_payroll
	,tardiness
	,actualregularhours
	,noofhourswork
	,Overtime_Hours
	,Nightdiff_Hours
	,regularnightshiftOT_hours
	,LegalHoliday_Hours
	,LegalHolidayOT_Hours
	,LegalHolidayND_Hours
	,lhotndh
	,Holiday_Special_Hours
	,Holiday_SpecialOT_Hours
	,Holiday_SpecialND_Hours
	,shotndh
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
	,allowance
	,totaldeduction
	,paythrough 
    ,bankaccountno 
    ,bankname
	,sssbasis
	,phibasis
	,schedsss
	

)
VALUES (
    @idtimekeep
    ,@idemployee
	,@fname
	,@lname
	,@datestart
	,@dateend
	,@payrolldate
	,@payrollmonth
	,@payrollmonthsort
	,@idclient
	,@iddepartment
	,@idclientbranch
	,@jobcode
	,@dailyrate
	,@tardiness
	,@totalhours
	,@reg
	,@regot 
	,@regnd 
	,@regotnd
	,@lh 
    ,@lhot 
    ,@lhnd
    ,@lhndot
	,@sh
    ,@shot
    ,@shnd
    ,@shndot
	,@rd 
	,@rdot
	,@rdnd 
	,@rdndot
	,@lhwdo
    ,@lhwdoot
	,@lhwdond
    ,@lhwdondot
	,@shwdo
    ,@shwdoot
	,@shwdond
    ,@shwdondot
	,@totalotherincome
	,@totaldeduction
	,@paythrough
    ,@bankaccountno
    ,@bankname 
	,@sssbasis
	,@phibasis
	,@schedsss

)



--positiondesc = client_branch_position.jobposition
--,dailyrate_payroll = client_branch_position.dailyratepayroll

--update rates 
UPDATE tk
SET
	tk.regrate = CAST(cbp.dailyratepayroll / 8.0 AS DECIMAL(18,2))
	,tk.regotrate = cbp.regularOTrate
	,tk.regndrate = cbp.nightdiffrate
	,tk.regndotrate = cbp.regularnightdiffOTrate
	
	,tk.lhrate = cbp.legalholidayrate
	,tk.lhotrate = cbp.legalholidayOTrate
	,tk.lhndrate = legalholidayNDrate
	,tk.lhndotrate = cbp.lhotndrate
	
	,tk.shrate = cbp.specialholidayrate
	,tk.shotrate= cbp.specialholidayOTrate
	,tk.shndrate = cbp.specialholidaynightdiffrate
	,tk.shndotrate = cbp.shotndrate
	
	,tk.wdorate= cbp.WDOrate
	
	,tk.rdrate= cbp.rdrate	
	,tk.rdotrate= cbp.rdotrate
	,tk.rdndrate=cbp.rdndrate
	,tk.rdndotrate = cbp.rdndotrate
	
	,tk.lhwdorate = cbp.lhwdorate
	,tk.lhwdootrate= cbp.lhwdootrate
	,tk.lhwdondrate = cbp.lhotndrate
	,tk.lhwdondotrate = cbp.lhwdootndrate
	
	,tk.shwdorate = cbp.wdoshrate
	,tk.shwdootrate= cbp.wdoshotrate
	,tk.shwdondrate = cbp.wdoshotndrate
	,tk.shwdondotrate = cbp.wdoshotndrate
	
	
    ,tk.sourceofdata = 'Template'
    ,tk.positiondesc = cbp.jobposition
    ,tk.tkstatus     = 'For Audit'
FROM tbl_timekeep AS tk
INNER JOIN Employee AS e
    ON tk.employeeid = e.Employee_id
INNER JOIN Department AS d
    ON TK.departmentcode = d.iddepartment
INNER JOIN client_branch_position AS cbp
    ON tk.idposition = cbp.idbranchposition
WHERE tk.idtimekeep = @idtimekeep;



--update timekeeptemp as processed 
UPDATE  tbl_timekeeptemp
SET tkstatus = 'Processed'
FROM    tbl_timekeeptemp
WHERE  (tbl_timekeeptemp.idtimekeeptemp = @idtimekeep)


	
COMMIT TRANSACTION; -- Commit the transaction if everything is successful
	
	END TRY
	BEGIN CATCH
		IF @@TRANCOUNT > 0
			ROLLBACK TRANSACTION; -- Rollback the transaction in case of an error

		-- Log or handle the error as per your requirements
		-- Example: Raising an error and returning the error message to the caller
		DECLARE @ErrorMessage NVARCHAR(4000);
		DECLARE @ErrorSeverity INT;
		DECLARE @ErrorState INT;

		SELECT 
			@ErrorMessage = ERROR_MESSAGE(),
			@ErrorSeverity = ERROR_SEVERITY(),
			@ErrorState = ERROR_STATE();

		RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
		RETURN;
	END CATCH;
END
