
-- =============================================
-- Author:		Pat Relos
-- Create date: 1-7-2025 2:00 PM
-- Description:	list if employee store in timekeep data grid 
-- =============================================
create PROCEDURE [dbo].[sp_tkdownloadtimekeeplist] 
	-- Add the parameters for the stored procedure here
	@idclient Int, 
	@iddepartment int,
	@datestart date, 
	@dateend date,
	@payrollstatus varchar(20),
	@tkstatus varchar(20)

	
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	BEGIN TRY
		BEGIN TRANSACTION; -- Start a transaction to rollback changes in case of an error

SELECT 
 tbl_timekeep.idtimekeep,
 tbl_timekeep.employeeid, 
 tbl_timekeep.idclient, 
 tbl_timekeep.datestart, 
 tbl_timekeep.dateend, 
 employee.idclientbranch, 
 employee.department_code, 
 employee.Position1, 
 employee.fname, 
 employee.lname, 
 employee.mname, 
 employee.lname, employee.fname, employee.lname + ', ' + employee.fname + ISNULL(' ' + LEFT(Employee.mname, 1) + '.', '') AS empname,
 employee.paythrough, 
 employee.bankname, 
 employee.bankaccountno, 
 client_branch_position.jobposition, 
 client_branch_position.dailyratepayroll, 
 tbl_timekeep.actualregularhours, 
 tbl_timekeep.noofhourswork, 
 tbl_timekeep.Overtime_Hours, 
 tbl_timekeep.Nightdiff_Hours, 
 tbl_timekeep.regularnightshiftOT_hours, 
 
 tbl_timekeep.LegalHoliday_Hours, 
 tbl_timekeep.LegalHolidayOT_Hours, 
 tbl_timekeep.LegalHolidayND_Hours, 
 tbl_timekeep.lhotndh, 
 
 tbl_timekeep.Holiday_Special_Hours, 
 tbl_timekeep.Holiday_SpecialND_Hours, 
 tbl_timekeep.Holiday_SpecialOT_Hours, 
 tbl_timekeep.shotndh, 
 
 tbl_timekeep.RDhours, 
 tbl_timekeep.RDothours, 
 tbl_timekeep.rdndhours, 
 tbl_timekeep.rdotndhours, 
 
 tbl_timekeep.lhwdohours, 
 tbl_timekeep.lhwdoothours, 
 tbl_timekeep.lhwdondhours, 
 tbl_timekeep.lhwdootndhours, 
 
 tbl_timekeep.shwdohours, 
 tbl_timekeep.shwdoothours, 
 tbl_timekeep.shwdondhours, 
 tbl_timekeep.shwdootndhours, 
 tbl_timekeep.totaldeduction, 
 tbl_timekeep.allowance, 

 
 tbl_timekeep.WDOhours, 
 
 tbl_timekeep.tardiness, 
 tbl_timekeep.undertime, 
 tbl_timekeep.absences, 
 tbl_timekeep.pto, 
 tbl_timekeep.remarks, 
 tbl_timekeep.downloaded, 
 Client.companyname,
 Client.basisofsssded,
 Client.basisofphilded,
 Client.schedstatutory,
 client_branch_position.regularOTrate,
 client_branch_position.nightdiffrate, 
 client_branch_position.regularnightdiffOTrate,

 client_branch_position.legalholidayrate, 
 client_branch_position.legalholidayOTrate,
 client_branch_position.legalholidayNDrate, 
 client_branch_position.lhotndrate,

 client_branch_position.specialholidayrate, 
 client_branch_position.specialholidayOTrate, 
 client_branch_position.specialholidaynightdiffrate, 
 client_branch_position.shotndrate,

 
 
 client_branch_position.RDrate, 
 client_branch_position.RDOTrate, 
 client_branch_position.RDNDrate, 
 client_branch_position.rdndotrate, 

 client_branch_position.LHWDORATE, 
 client_branch_position.LHWDOOTRATE, 
 client_branch_position.LHWDONDRATE, 
 client_branch_position.LHWDOOTNDRATE, 

 client_branch_position.WDOSHRATE, 
 client_branch_position.WDOSHOTRATE, 
 client_branch_position.WDOSHNDRATE, 
 client_branch_position.WDOSHOTNDRATE,


 client_branch_position.WDOrate, 
 client_branch_position.LHonRDOT,
 client_branch_position.SHonRDOT



 From Employee
 INNER JOIN tbl_timekeep 
 On Employee.Employee_id = tbl_timekeep.employeeid
 INNER JOIN client_branch_position 
 On Employee.Position1 = client_branch_position.idbranchposition
 INNER JOIN client 
 On Employee.idclient = client.idclient
 
 WHERE   tbl_timekeep.idclient = @idclient
  And tbl_timekeep.datestart =@datestart
  And tbl_timekeep.dateend = @dateend
  And tbl_timekeep.payrollstatus = @payrollstatus
  And tbl_timekeep.tkstatus = @tkstatus
 ORDER BY tbl_timekeep.idtimekeep

		
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
