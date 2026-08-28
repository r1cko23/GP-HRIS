
-- =============================================
-- Author:		Pat Relos
-- Create date: 2023.July.04 @ 04:03
-- Description:	list if employee store in timekeep data grid 
-- =============================================
CREATE PROCEDURE [dbo].[sp_tkdglist] 
	-- Add the parameters for the stored procedure here
	@idclient Int, 
	@iddepartment int,
	@datestart date, 
	@dateend date, 
	@payrolldate date, 
	@trxtype nvarchar(20)
	
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	BEGIN TRY
		BEGIN TRANSACTION; -- Start a transaction to rollback changes in case of an error



SELECT  
	 tk.id
    ,tk.idtimekeep
    ,tk.employeeid
    ,e.lname
    ,e.fname
    ,e.lname + ', ' + e.fname + ISNULL(' ' + LEFT(e.mname, 1) + '.', '') AS empname
	,tk.idposition
	,tk.positiondesc
	,tk.dailyrate_payroll
	,tk.tkstatus
	,tk.datestart
	,tk.dateend
	,tk.payrolldate
	,tk.payrollyear
	,tk.payrollmonth
	,tk.payrollyear
	,tk.sourceofdata
	,tk.payrollstatus
	,tk.billingstatus
	,tk.idclient
	,tk.departmentcode




FROM tbl_timekeep tk
INNER JOIN [GREENHRISMAIN].dbo.Employee e 
    ON tk.employeeid = e.Employee_id

WHERE tk.idclient = @idclient
AND tk.departmentcode = @iddepartment
AND tk.datestart = @datestart
AND tk.dateend = @dateend
AND tk.payrolldate = @payrolldate
AND TK.trxtype= @trxtype

--AND payroll_summary.department_codep = @iddepartment
--and payroll_summary.idclientbranchp = @idclientbranch
--AND (payroll_summary.fname2 LIKE '%' + @filtertxt + '%'
--OR payroll_summary.lname2 LIKE '%' + @filtertxt + '%'
--OR payroll_summary.jobposition2 LIKE '%' + @filtertxt + '%')
order by lname,fname
		
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
